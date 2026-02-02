import { BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { SttClient } from "./sttClient";
import { checkRealtimeAccess } from "./realtimeSttClient";
import { enrichTranscript, updateWithFollowUp } from "./enrichLlm";
import { DEFAULT_HOTKEY, getSettingsSafe, resetSettings, setSettings } from "./settings";
import { Mode } from "../src/lib/schemas";
import { sendWebhook, WebhookPayload } from "./n8nWebhook";
import { getRun, listRunsWithResults, renameRun, saveRun, setRunCoverage } from "./historyDb";
import { listModes, getModeById } from "./modes";
import { computeCoverage } from "./schemaCoverage";

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
      const nextHotkey = String(payload.hotkey).trim();
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

  ipcMain.handle("settings.reset", () => {
    let hotkeyError: string | null = null;
    if (onHotkeyChange && !onHotkeyChange(DEFAULT_HOTKEY)) {
      hotkeyError = "Hotkey could not be registered. It may be in use by the system.";
    }
    resetSettings();
    return { ...getSettingsSafe(), hotkeyError };
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
      const modeDef = getModeById(mode);
      const coverage = modeDef ? computeCoverage(modeDef, result).percent : null;
      const runId = await saveRun({
        name: deriveRunName(result),
        createdAt: new Date().toISOString(),
        mode,
        transcript: payload.transcript,
        result,
        changeLog: [],
        isFollowUp: false,
        coverage
      });
      sendToRenderer("app.state", { state: "done" });
      sendToRenderer("llm.result", { json: result, mode, runId, coverage });
      void dispatchWebhook(payload.transcript, result, mode);
      return { result, mode, runId, coverage };
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
        const modeDef = getModeById(mode);
        const coverage = modeDef ? computeCoverage(modeDef, result).percent : null;
        const runId = await saveRun({
          name: deriveRunName(result),
          createdAt: new Date().toISOString(),
          mode,
          transcript: payload.transcript,
          result,
          changeLog,
          isFollowUp: true,
          parentId: payload.previousId ?? null,
          coverage
        });
        sendToRenderer("app.state", { state: "done" });
        sendToRenderer("llm.updated", { json: result, mode, changeLog, runId, coverage });
        void dispatchWebhook(payload.transcript, result, mode);
        return { result, mode, changeLog, runId, coverage };
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
    const rows = await listRunsWithResults(payload?.limit ?? 50);
    const items = rows.map((row) => {
      let coverage = typeof row.coverage === "number" ? row.coverage : null;
      if (coverage === null && row.result) {
        const modeDef = getModeById(String(row.mode));
        if (modeDef) {
          coverage = computeCoverage(modeDef, row.result).percent;
          void setRunCoverage(Number(row.id), coverage);
        }
      }
      return {
        id: Number(row.id),
        name: String(row.name),
        created_at: String(row.created_at),
        mode: String(row.mode),
        is_followup: Number(row.is_followup),
        parent_id: row.parent_id === null ? null : Number(row.parent_id),
        coverage
      };
    });
    return items;
  });

  ipcMain.handle("history.get", async (_event, payload: { id: number }) => {
    const run = await getRun(payload.id);
    if (!run) return null;
    let coverage = typeof run.coverage === "number" ? run.coverage : null;
    if (coverage === null) {
      const modeDef = getModeById(String(run.mode));
      if (modeDef) {
        coverage = computeCoverage(modeDef, run.result).percent;
        await setRunCoverage(run.id, coverage);
      }
    }
    return { ...run, coverage };
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
