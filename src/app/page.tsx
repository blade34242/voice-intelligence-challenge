"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OverlayShell } from "../components/OverlayShell";
import { RecorderPanel } from "../components/RecorderPanel";
import { TabsView } from "../components/TabsView";
import { SettingsModal } from "../components/SettingsModal";
import { HistoryPanel } from "../components/HistoryPanel";
import {
  ipcClient,
  AppState,
  HistoryItem,
  LlmResult,
  ModeInfo,
  SettingsSafe,
  WebhookPayload
} from "../lib/ipcClient";
import { ChangeLogEntry, Mode } from "../lib/schemas";

const SAMPLE_RATE = 24000;
const FRAME_SIZE = 480;

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [mode] = useState<Mode>("auto");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [editableTranscript, setEditableTranscript] = useState("");
  const [editedDirty, setEditedDirty] = useState(false);
  const [result, setResult] = useState<LlmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsSafe | null>(null);
  const [modeOptions, setModeOptions] = useState<ModeInfo[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [resolvedMode, setResolvedMode] = useState<Mode | null>(null);
  const [overrideMode, setOverrideMode] = useState<Mode | null>(null);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [activeTransport, setActiveTransport] = useState("batch");
  const [followUpBase, setFollowUpBase] = useState<LlmResult | null>(null);
  const [followUpMode, setFollowUpMode] = useState<Mode | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentRunId, setCurrentRunId] = useState<number | null>(null);
  const [currentRunName, setCurrentRunName] = useState("Untitled Run");
  const [currentRunNameSaved, setCurrentRunNameSaved] = useState("Untitled Run");
  const [currentRunNameDirty, setCurrentRunNameDirty] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const exportButtonRef = useRef<HTMLButtonElement | null>(null);
  const [exportMenuPos, setExportMenuPos] = useState<{ x: number; y: number } | null>(null);

  const modeRef = useRef(mode);
  const appStateRef = useRef(appState);
  const startRef = useRef<() => void>(() => undefined);
  const captureRef = useRef<{ stop: () => void } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const followUpRef = useRef<{ result: LlmResult | null; mode: Mode | null; id: number | null }>({
    result: null,
    mode: null,
    id: null
  });

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    followUpRef.current = { result: followUpBase, mode: followUpMode, id: currentRunId };
  }, [followUpBase, followUpMode, currentRunId]);

  useEffect(() => {
    startRef.current = handleStart;
  });

  useEffect(() => {
    if (!exportOpen) return;
    const updatePos = () => {
      if (!exportButtonRef.current) return;
      const rect = exportButtonRef.current.getBoundingClientRect();
      setExportMenuPos({ x: rect.right, y: rect.top });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [exportOpen]);

  const refreshHistory = async () => {
    if (!ipcClient.isAvailable()) return;
    try {
      const items = await ipcClient.invoke("history.list", { limit: 50 });
      setHistory(items);
    } catch {
      // ignore history errors
    }
  };

  useEffect(() => {
    if (result) {
      const base = result.clean_transcript || finalTranscript;
      setEditableTranscript(base);
      setEditedDirty(false);
    }
  }, [result, finalTranscript]);

  const filteredHistory = history.filter((item) => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.mode.toLowerCase().includes(q) ||
      String(item.id).includes(q)
    );
  });

  useEffect(() => {
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      return;
    }

    ipcClient
      .invoke("settings.get")
      .then((data) => {
        setSettings(data);
        setActiveTransport(data?.sttTransport ?? "batch");
      })
      .catch((err) => {
        setError(err?.message ?? "Settings unavailable.");
      });
    void refreshHistory();
    ipcClient
      .invoke("modes.list")
      .then((modes) => setModeOptions(modes))
      .catch(() => setModeOptions([]));

    const unsubscribers = [
      ipcClient.on("app.state", ({ state }) => setAppState(state)),
      ipcClient.on("stt.delta", ({ textDelta }) => {
        setLiveTranscript((prev) => prev + textDelta);
      }),
      ipcClient.on("stt.live", ({ liveText }) => {
        setLiveTranscript(liveText);
      }),
      ipcClient.on("stt.final", ({ finalTranscript: finalText }) => {
        setFinalTranscript(finalText);
        setLiveTranscript(finalText);
        if (finalText.trim().length > 0) {
          const followUp = followUpRef.current;
          if (followUp.result) {
            ipcClient
              .invoke("llm.update", {
                transcript: finalText,
                mode: followUp.mode ?? modeRef.current,
                previous: followUp.result,
                previousId: followUp.id ?? undefined
              })
              .catch((err) => {
                setError(err.message ?? "LLM error");
                setAppState("error");
              })
              .finally(() => {
                setFollowUpBase(null);
                setFollowUpMode(null);
              });
          } else {
            ipcClient.invoke("llm.enrich", { transcript: finalText, mode: modeRef.current }).catch((err) => {
              setError(err.message ?? "LLM error");
              setAppState("error");
            });
          }
        }
      }),
      ipcClient.on("stt.error", ({ message }) => {
        captureRef.current?.stop();
        captureRef.current = null;
        stopTimer();
        setError(message);
        setAppState("error");
        setFollowUpBase(null);
        setFollowUpMode(null);
      }),
      ipcClient.on("llm.result", ({ json, mode: chosenMode, runId }) => {
        setResult(json);
        setResolvedMode(chosenMode);
        setOverrideMode(null);
        setChangeLog([]);
        setCurrentRunId(runId ?? null);
        const name = deriveRunName(json);
        setCurrentRunName(name);
        setCurrentRunNameSaved(name);
        setCurrentRunNameDirty(false);
        void refreshHistory();
        setAppState("done");
      }),
      ipcClient.on("llm.updated", ({ json, mode: chosenMode, changeLog, runId }) => {
        setResult(json);
        setResolvedMode(chosenMode);
        setOverrideMode(null);
        setChangeLog(changeLog ?? []);
        setCurrentRunId(runId ?? null);
        const name = deriveRunName(json);
        setCurrentRunName(name);
        setCurrentRunNameSaved(name);
        setCurrentRunNameDirty(false);
        void refreshHistory();
        setAppState("done");
      }),
      ipcClient.on("llm.error", ({ message }) => {
        stopTimer();
        setError(message);
        setAppState("error");
      }),
      ipcClient.on("settings.open", () => setSettingsOpen(true)),
      ipcClient.on("record.start", () => {
        const current = appStateRef.current;
        if (current === "recording" || current === "finalizing_transcript" || current === "enriching") {
          return;
        }
        startRef.current();
      }),
      ipcClient.on("record.stop", () => {
        const current = appStateRef.current;
        if (current !== "recording") return;
        handleStop();
      })
    ];

    return () => {
      unsubscribers.forEach((off) => off());
    };
  }, []);

  const startTimer = () => {
    stopTimer();
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((prev) => prev + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStart = async () => {
    if (appState === "recording" || appState === "finalizing_transcript" || appState === "enriching") {
      return;
    }
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      setAppState("error");
      return;
    }
    setError(null);
    setNotice(null);
    setResult(null);
    setLiveTranscript("");
    setFinalTranscript("");
    setResolvedMode(null);
    setOverrideMode(null);
    setChangeLog([]);
    setExportOpen(false);

    try {
      const response = await ipcClient.invoke("stt.start");
      if (response?.notice) {
        setNotice(response.notice);
      }
      if (response?.transport) {
        setActiveTransport(response.transport);
      }
      captureRef.current = await startAudioCapture((frame) => {
        ipcClient.invoke("stt.audioFrame", { pcm16Buffer: frame }).catch(() => undefined);
      });
      setAppState("recording");
      startTimer();
    } catch (err: any) {
      setError(err?.message ?? "Unable to start recording");
      setAppState("error");
    }
  };

  const handleStop = async () => {
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      setAppState("error");
      return;
    }
    captureRef.current?.stop();
    captureRef.current = null;
    stopTimer();

    try {
      await ipcClient.invoke("stt.stop");
    } catch (err: any) {
      setError(err?.message ?? "Unable to stop recording");
      setAppState("error");
    }
  };

  const handleSaveSettings = async (payload: {
    apiKey?: string;
    n8nWebhookUrl?: string;
    n8nSharedSecret?: string;
    sttLanguage?: string;
    sttModel?: string;
    sttTransport?: string;
    hotkey?: string;
  }) => {
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      setAppState("error");
      return;
    }
    try {
      const updated = await ipcClient.invoke("settings.set", payload);
      setSettings(updated);
      setActiveTransport(updated.sttTransport ?? "batch");
      setSettingsOpen(false);
    } catch (err: any) {
      setError(err?.message ?? "Unable to save settings");
      setAppState("error");
    }
  };

  const handleCopyOutput = async () => {
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      setAppState("error");
      return;
    }
    if (result) {
      const text = buildCopyText();
      await ipcClient.invoke("clipboard.copy", { text });
    }
  };

  const handleExportJson = async () => {
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      setAppState("error");
      return;
    }
    if (result) {
      await ipcClient.invoke("export.json", { data: result, suggestedName: "everlast-output" });
      setExportOpen(false);
    }
  };

  const handleExportMd = async () => {
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      setAppState("error");
      return;
    }
    if (result) {
      await ipcClient.invoke("export.md", {
        markdown: buildCopyText(),
        suggestedName: "everlast-output"
      });
      setExportOpen(false);
    }
  };

  const handleSendWebhook = async () => {
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      setAppState("error");
      return;
    }
    const payload = buildWebhookPayload();
    if (!payload) {
      setError("No result to send.");
      setAppState("error");
      return;
    }
    try {
      const response = await ipcClient.invoke("n8n.webhook", payload);
      if (!response?.ok) {
        const message =
          response?.skipped ? "Webhook URL not set in Settings." : response?.message ?? "Webhook failed.";
        setError(message);
        setAppState("error");
      }
    } catch (err: any) {
      setError(err?.message ?? "Webhook failed");
      setAppState("error");
    }
  };

  const handleExportWebhookJson = async () => {
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      setAppState("error");
      return;
    }
    const payload = buildWebhookPayload();
    if (!payload) {
      setError("No result to export.");
      setAppState("error");
      return;
    }
    await ipcClient.invoke("export.json", { data: payload, suggestedName: "everlast-webhook" });
    setExportOpen(false);
  };

  const handleRegenerate = async () => {
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      setAppState("error");
      return;
    }
    if (!finalTranscript.trim()) return;
    setAppState("enriching");
    setChangeLog([]);
    try {
      await ipcClient.invoke("llm.enrich", { transcript: finalTranscript, mode: overrideMode ?? mode });
    } catch (err: any) {
      setError(err?.message ?? "LLM error");
      setAppState("error");
    }
  };

  const handleFollowUpRecord = () => {
    if (!result || !currentRunId) return;
    setFollowUpBase(result);
    setFollowUpMode(overrideMode ?? resolvedMode ?? "note");
    setChangeLog([]);
    handleStart();
  };

  const handleHistoryLoad = async (id: number) => {
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      setAppState("error");
      return;
    }
    try {
      const run = await ipcClient.invoke("history.get", { id });
      if (!run) {
        setError("History item not found.");
        setAppState("error");
        return;
      }
      setResult(run.result);
      setFinalTranscript(run.transcript);
      setEditableTranscript(run.transcript);
      setResolvedMode(run.mode);
      setOverrideMode(null);
      setChangeLog(run.changeLog ?? []);
      setCurrentRunId(run.id);
      const name = run.name ?? "Untitled Run";
      setCurrentRunName(name);
      setCurrentRunNameSaved(name);
      setCurrentRunNameDirty(false);
      setAppState("done");
    } catch (err: any) {
      setError(err?.message ?? "Unable to load history.");
      setAppState("error");
    }
  };

  const handleHistoryRename = async (id: number, name: string) => {
    if (!ipcClient.isAvailable()) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await ipcClient.invoke("history.rename", { id, name: trimmed });
      if (id === currentRunId) {
        setCurrentRunName(trimmed);
        setCurrentRunNameSaved(trimmed);
        setCurrentRunNameDirty(false);
      }
      void refreshHistory();
    } catch (err: any) {
      setError(err?.message ?? "Unable to rename run.");
      setAppState("error");
    }
  };

  const handleRerunWithEdits = async () => {
    if (!ipcClient.isAvailable()) {
      setError("Electron IPC unavailable. Open the app via Electron.");
      setAppState("error");
      return;
    }
    const edited = editableTranscript.trim();
    if (!edited) return;
    setFinalTranscript(edited);
    setAppState("enriching");
    try {
      await ipcClient.invoke("llm.enrich", { transcript: edited, mode: overrideMode ?? mode });
    } catch (err: any) {
      setError(err?.message ?? "LLM error");
      setAppState("error");
    }
  };

  const handleOverrideMode = async (nextMode: Mode) => {
    if (!finalTranscript.trim()) return;
    setOverrideMode(nextMode);
    setAppState("enriching");
    setChangeLog([]);
    try {
      await ipcClient.invoke("llm.enrich", { transcript: finalTranscript, mode: nextMode });
    } catch (err: any) {
      setError(err?.message ?? "LLM error");
      setAppState("error");
    }
  };

  const resetSession = () => {
    captureRef.current?.stop();
    captureRef.current = null;
    stopTimer();
    setElapsed(0);
    setError(null);
    setNotice(null);
    setResult(null);
    setLiveTranscript("");
    setFinalTranscript("");
    setEditableTranscript("");
    setEditedDirty(false);
    setResolvedMode(null);
    setChangeLog([]);
    setFollowUpBase(null);
    setFollowUpMode(null);
    setCurrentRunId(null);
    setCurrentRunName("Untitled Run");
    setCurrentRunNameSaved("Untitled Run");
    setCurrentRunNameDirty(false);
    setExportOpen(false);
    setHistoryOpen(false);
    setAppState("idle");
  };

  const closeOverlay = () => {
    if (appState !== "recording" && appState !== "finalizing_transcript" && appState !== "enriching") {
      resetSession();
    }
    if (ipcClient.isAvailable()) {
      ipcClient.invoke("overlay.hide");
    } else {
      window.close();
    }
  };

  const timerDisplay = appState === "recording" ? formatTimer(elapsed) : undefined;
  const transportLabel = activeTransport === "realtime" ? "Realtime" : "Batch";
  const languageLabel = formatLanguageLabel(settings?.sttLanguage);
  const quickModeLabel = resolvedMode
    ? `Auto (${modeOptions.find((m) => m.id === resolvedMode)?.label ?? resolvedMode})`
    : "Auto (LLM decides)";

  return (
    <main className="app">
      <OverlayShell
        state={appState}
        mode={mode}
        timer={timerDisplay}
        transportLabel={transportLabel}
        transportTone={activeTransport === "realtime" ? "realtime" : "batch"}
        allowModeChange={false}
        modeDisplay={quickModeLabel}
        modeControl={
          appState === "done" && result ? (
            <>
              <select
                className="mode-select"
                value={overrideMode ?? resolvedMode ?? (modeOptions[0]?.id ?? "auto")}
                onChange={(event) => handleOverrideMode(event.target.value as Mode)}
              >
                {modeOptions.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </select>
              <span className="mode-hint">Change type if misclassified</span>
            </>
          ) : undefined
        }
        onClose={closeOverlay}
        actions={
          <div className="footer-actions">
            <div className="footer-group">
              <button className="secondary" onClick={() => setHistoryOpen((prev) => !prev)}>
                History
              </button>
              <button className="secondary" onClick={resetSession}>
                New Run
              </button>
            </div>
            <div className="footer-group center">
              <button className="primary" onClick={handleCopyOutput} disabled={!result}>
                Copy Output
              </button>
              <button className="secondary" onClick={handleFollowUpRecord} disabled={!currentRunId || !result}>
                Record Follow-up
              </button>
              <button className="secondary" onClick={handleRegenerate} disabled={!result}>
                Regenerate
              </button>
            </div>
            <div className="footer-group right">
              <div className="export-menu">
                <button
                  ref={exportButtonRef}
                  className="secondary"
                  onClick={() => result && setExportOpen((prev) => !prev)}
                  disabled={!result}
                >
                  Export ▾
                </button>
              </div>
              <button
                className="secondary"
                onClick={handleSendWebhook}
                disabled={!result || !settings?.n8nWebhookUrl}
              >
                Send Webhook
              </button>
              <button className="secondary" onClick={closeOverlay}>
                Close
              </button>
            </div>
          </div>
        }
      >
        <div className="main-canvas">
          {historyOpen ? <div className="history-backdrop" onClick={() => setHistoryOpen(false)} /> : null}
          <div className={`history-drawer ${historyOpen ? "open" : ""}`}>
            <HistoryPanel
              history={filteredHistory}
              query={historyQuery}
              onQueryChange={setHistoryQuery}
              onRefresh={refreshHistory}
              onLoad={(id) => {
                setHistoryOpen(false);
                handleHistoryLoad(id);
              }}
              onRename={handleHistoryRename}
              showCurrent={appState === "done" && Boolean(result)}
              currentRunId={currentRunId}
              currentRunName={currentRunName}
              currentRunNameDirty={currentRunNameDirty}
              onCurrentRunNameChange={(value) => {
                setCurrentRunName(value);
                setCurrentRunNameDirty(value.trim() !== currentRunNameSaved.trim());
              }}
              onCurrentRunNameSave={() => {
                if (currentRunId) {
                  void handleHistoryRename(currentRunId, currentRunName);
                }
              }}
            />
          </div>
          <section className="main-panel">
            {appState === "done" && result ? (
              <TabsView
                result={result}
                fallbackTranscript={finalTranscript}
                editableTranscript={editableTranscript}
                onTranscriptChange={(value) => {
                  setEditableTranscript(value);
                  const base = (result.clean_transcript || finalTranscript).trim();
                  setEditedDirty(value.trim() !== base);
                }}
                onRerunEdits={handleRerunWithEdits}
                hasEdits={editedDirty}
                changeLog={changeLog}
              />
            ) : (
              <RecorderPanel
                state={appState}
                transcript={liveTranscript}
                placeholder="Press Start and speak..."
                onStart={handleStart}
                onStop={handleStop}
                onSettings={() => setSettingsOpen(true)}
                onReset={resetSession}
                transportLabel={transportLabel}
                transportTone={activeTransport === "realtime" ? "realtime" : "batch"}
                error={error}
                notice={notice}
                hotkey={settings?.hotkey}
                modeLabel={quickModeLabel}
                languageLabel={languageLabel}
              />
            )}
          </section>
        </div>
        {exportOpen && exportMenuPos
          ? createPortal(
              <div className="export-portal" onClick={() => setExportOpen(false)}>
                <div
                  className="export-portal-menu"
                  style={{ left: exportMenuPos.x, top: exportMenuPos.y }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button className="secondary" onClick={handleExportJson}>
                    Export JSON
                  </button>
                  <button className="secondary" onClick={handleExportMd}>
                    Export Markdown
                  </button>
                  <button className="secondary" onClick={handleExportWebhookJson}>
                    Export Webhook JSON
                  </button>
                </div>
              </div>,
              document.body
            )
          : null}
        {(appState === "finalizing_transcript" || appState === "enriching") && (
          <div className="processing">
            <div className="spinner" />
            <span>{appState === "finalizing_transcript" ? "Finalizing transcript..." : "Generating output..."}</span>
          </div>
        )}
      </OverlayShell>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </main>
  );

  function buildWebhookPayload(): WebhookPayload | null {
    if (!result) return null;
    const chosenMode = (resolvedMode ?? modeOptions[0]?.id ?? "note") as Mode;
    const route = modeOptions.find((m) => m.id === chosenMode)?.route;
    return {
      source: "everlast",
      created_at: new Date().toISOString(),
      mode: chosenMode,
      kind: route ?? chosenMode,
      route,
      transcript: finalTranscript,
      result
    };
  }

  function buildCopyText() {
    if (!result) return "";
    const data = JSON.stringify(result.data ?? {}, null, 2);
    const actions = result.actions.length ? `\n\nActions:\n- ${result.actions.join("\n- ")}` : "";
    return `${result.summary}\n\nData:\n${data}${actions}`.trim();
  }
}

function formatTimer(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function deriveRunName(result: LlmResult) {
  const data = result.data as Record<string, any> | undefined;
  if (data?.title) return String(data.title);
  if (data?.subject) return String(data.subject);
  if (data?.name) return String(data.name);
  if (result.summary) return result.summary.slice(0, 60);
  return "Untitled Run";
}

function formatLanguageLabel(language?: string) {
  if (!language || language === "auto") return "Auto";
  return language.toUpperCase();
}

async function startAudioCapture(onFrame: (frame: ArrayBuffer) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);

  let node: AudioNode;
  let workletUrl: string | null = null;
  const buffer: number[] = [];

  const handleChunk = (chunk: Float32Array) => {
    const resampled = resampleBuffer(chunk, context.sampleRate, SAMPLE_RATE);
    const pcm16 = floatTo16(resampled);
    for (let i = 0; i < pcm16.length; i += 1) {
      buffer.push(pcm16[i]);
    }
    while (buffer.length >= FRAME_SIZE) {
      const frame = buffer.splice(0, FRAME_SIZE);
      const int16 = new Int16Array(frame);
      const ab = int16.buffer.slice(int16.byteOffset, int16.byteOffset + int16.byteLength);
      onFrame(ab);
    }
  };

  if (context.audioWorklet) {
    const workletCode = `
      class PCMWorkletProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0];
          if (input && input[0]) {
            this.port.postMessage(input[0]);
          }
          return true;
        }
      }
      registerProcessor('pcm-capture', PCMWorkletProcessor);
    `;
    workletUrl = URL.createObjectURL(new Blob([workletCode], { type: "application/javascript" }));
    await context.audioWorklet.addModule(workletUrl);
    const workletNode = new AudioWorkletNode(context, "pcm-capture");
    workletNode.port.onmessage = (event) => handleChunk(event.data as Float32Array);
    const silentGain = context.createGain();
    silentGain.gain.value = 0;
    source.connect(workletNode).connect(silentGain).connect(context.destination);
    node = workletNode;
  } else {
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      handleChunk(input);
    };
    const silentGain = context.createGain();
    silentGain.gain.value = 0;
    source.connect(processor).connect(silentGain).connect(context.destination);
    node = processor;
  }

  return {
    stop: () => {
      node.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      context.close();
      if (workletUrl) {
        URL.revokeObjectURL(workletUrl);
      }
    }
  };
}

function resampleBuffer(input: Float32Array, inRate: number, outRate: number) {
  if (inRate === outRate) return input;
  const ratio = inRate / outRate;
  const newLength = Math.round(input.length / ratio);
  const output = new Float32Array(newLength);
  for (let i = 0; i < newLength; i += 1) {
    const idx = i * ratio;
    const idx0 = Math.floor(idx);
    const idx1 = Math.min(idx0 + 1, input.length - 1);
    const frac = idx - idx0;
    output[i] = input[idx0] + (input[idx1] - input[idx0]) * frac;
  }
  return output;
}

function floatTo16(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}
