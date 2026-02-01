import { BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { SttClient } from "./sttClient";
import { checkRealtimeAccess } from "./realtimeSttClient";
import { enrichTranscript, updateWithFollowUp } from "./enrichLlm";
import { getSettingsSafe, normalizeHotkey, setSettings } from "./settings";
import { Mode } from "../src/lib/schemas";
import { sendWebhook, WebhookPayload } from "./n8nWebhook";
import { getRun, listRuns, renameRun, saveRun } from "./historyDb";
import { listModes, getModeById } from "./modes";

export function registerIpcHandlers(params: {
  getMainWindow: () => BrowserWindow | null;
  stt: SttClient;
  sendToRenderer: (channel: string, payload?: any) => void;
  openSettings: () => void;
  onRecordingChange?: (active: boolean) => void;
  onHotkeyChange?: (hotkey: string) => boolean;
}) {
  const { getMainWindow, stt, sendToRenderer, openSettings, onRecordingChange, onHotkeyChange } = params;

  ipcMain.handle("overlay.open", () => {
    const win = getMainWindow();
    if (win) {
      win.show();
      win.focus();
    }
  });

  ipcMain.handle("overlay.hide", () => {
    const win = getMainWindow();
    if (win) {
      win.hide();
    }
  });

  ipcMain.handle("settings.get", () => getSettingsSafe());

  ipcMain.handle("settings.set", (_event, payload) => {
    if (payload?.hotkey !== undefined) {
      const nextHotkey = normalizeHotkey(String(payload.hotkey).trim());
      if (!nextHotkey) {
        throw new Error("Hotkey cannot be empty.");
      }
      if (onHotkeyChange && !onHotkeyChange(nextHotkey)) {
        throw new Error("Hotkey could not be registered. It may be in use by the system.");
      }
    }
    setSettings(payload);
    return getSettingsSafe();
  });

  ipcMain.handle("settings.open", () => {
    openSettings();
  });

  ipcMain.handle("stt.start", async () => {
    try {
      sendToRenderer("app.state", { state: "recording" });
      const info = await stt.start();
      onRecordingChange?.(true);
      return { ok: true, ...info };
    } catch (err: any) {
      const message = err?.message ?? "Failed to start STT.";
      sendToRenderer("stt.error", { message });
      sendToRenderer("app.state", { state: "error" });
      onRecordingChange?.(false);
      throw err;
    }
  });

  ipcMain.handle("stt.audioFrame", (_event, payload: { pcm16Buffer: ArrayBuffer }) => {
    stt.appendAudio(payload.pcm16Buffer);
  });

  ipcMain.handle("stt.realtimeCheck", async () => {
    return checkRealtimeAccess();
  });

  ipcMain.handle("stt.stop", async () => {
    try {
      sendToRenderer("app.state", { state: "finalizing_transcript" });
      const transcript = await stt.stop();
      sendToRenderer("stt.final", { finalTranscript: transcript });
      if (!transcript.trim()) {
        sendToRenderer("stt.error", { message: "No audio captured. Please try again." });
        sendToRenderer("app.state", { state: "error" });
      }
      onRecordingChange?.(false);
      return { transcript };
    } catch (err: any) {
      const message = err?.message ?? "Failed to finalize transcription.";
      sendToRenderer("stt.error", { message });
      sendToRenderer("app.state", { state: "error" });
      onRecordingChange?.(false);
      throw err;
    }
  });

  ipcMain.handle("llm.enrich", async (_event, payload: { transcript: string; mode: Mode }) => {
    try {
      sendToRenderer("app.state", { state: "enriching" });
      const { result, mode } = await enrichTranscript(payload);
      const runId = await saveRun({
        name: deriveRunName(result),
        createdAt: new Date().toISOString(),
        mode,
        transcript: payload.transcript,
        result,
        changeLog: [],
        isFollowUp: false
      });
      sendToRenderer("app.state", { state: "done" });
      sendToRenderer("llm.result", { json: result, mode, runId });
      void dispatchWebhook(payload.transcript, result, mode);
      return { result, mode, runId };
    } catch (err: any) {
      const message = err?.message ?? "Enrichment failed.";
      sendToRenderer("llm.error", { message });
      sendToRenderer("app.state", { state: "error" });
      throw err;
    }
  });

  ipcMain.handle(
    "llm.update",
    async (_event, payload: { transcript: string; mode: Mode; previous: any; previousId?: number }) => {
      try {
        sendToRenderer("app.state", { state: "enriching" });
        const { result, mode, changeLog } = await updateWithFollowUp({
          transcript: payload.transcript,
          mode: payload.mode,
          previous: payload.previous
        });
        const runId = await saveRun({
          name: deriveRunName(result),
          createdAt: new Date().toISOString(),
          mode,
          transcript: payload.transcript,
          result,
          changeLog,
          isFollowUp: true,
          parentId: payload.previousId ?? null
        });
        sendToRenderer("app.state", { state: "done" });
        sendToRenderer("llm.updated", { json: result, mode, changeLog, runId });
        void dispatchWebhook(payload.transcript, result, mode);
        return { result, mode, changeLog, runId };
      } catch (err: any) {
        const message = err?.message ?? "Update failed.";
        sendToRenderer("llm.error", { message });
        sendToRenderer("app.state", { state: "error" });
        throw err;
      }
    }
  );

  ipcMain.handle("clipboard.copy", (_event, payload: { text: string }) => {
    clipboard.writeText(payload.text);
    return { ok: true };
  });

  ipcMain.handle(
    "export.json",
    async (_event, payload: { data: unknown; suggestedName: string }) => {
      const win = getMainWindow();
      const options = {
        defaultPath: path.join(process.cwd(), `${payload.suggestedName}.json`),
        filters: [{ name: "JSON", extensions: ["json"] }]
      };
      const { filePath } = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (filePath) {
        fs.writeFileSync(filePath, JSON.stringify(payload.data, null, 2));
      }
      return { filePath };
    }
  );

  ipcMain.handle(
    "export.md",
    async (_event, payload: { markdown: string; suggestedName: string }) => {
      const win = getMainWindow();
      const options = {
        defaultPath: path.join(process.cwd(), `${payload.suggestedName}.md`),
        filters: [{ name: "Markdown", extensions: ["md"] }]
      };
      const { filePath } = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (filePath) {
        fs.writeFileSync(filePath, payload.markdown);
      }
      return { filePath };
    }
  );

  ipcMain.handle("n8n.webhook", async (_event, payload: WebhookPayload) => {
    return sendWebhook(payload);
  });

  ipcMain.handle("modes.list", () => {
    return listModes();
  });

  ipcMain.handle("history.list", async (_event, payload?: { limit?: number }) => {
    return await listRuns(payload?.limit ?? 50);
  });

  ipcMain.handle("history.get", async (_event, payload: { id: number }) => {
    return await getRun(payload.id);
  });

  ipcMain.handle("history.rename", async (_event, payload: { id: number; name: string }) => {
    const name = (payload.name ?? "").trim();
    if (!name) {
      throw new Error("Name cannot be empty.");
    }
    return await renameRun(payload.id, name);
  });
}

async function dispatchWebhook(transcript: string, result: any, mode: string) {
  const route = getModeById(mode)?.route ?? mode;
  const payload: WebhookPayload = {
    source: "everlast",
    created_at: new Date().toISOString(),
    mode,
    kind: route,
    route,
    transcript,
    result,
  };
  await sendWebhook(payload);
}

function deriveRunName(result: any) {
  const data = result?.data ?? {};
  if (data?.title) return String(data.title);
  if (data?.subject) return String(data.subject);
  if (data?.name) return String(data.name);
  if (result?.summary) return String(result.summary).slice(0, 60);
  return "Untitled Run";
}
