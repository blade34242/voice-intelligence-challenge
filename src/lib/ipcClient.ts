import { ChangeLogEntry, Mode, RunOutput } from "./schemas";

export type AppState =
  | "idle"
  | "recording"
  | "finalizing_transcript"
  | "enriching"
  | "done"
  | "error";

export type LlmResult = RunOutput;

export type HistoryItem = {
  id: number;
  name: string;
  created_at: string;
  mode: Mode;
  is_followup: number;
  parent_id: number | null;
  coverage?: number | null;
};

export type HistoryRun = HistoryItem & {
  transcript: string;
  result: LlmResult;
  changeLog: ChangeLogEntry[];
};

export type ModeInfo = {
  id: string;
  label: string;
  description: string;
  route: string;
};

export type WebhookPayload = {
  source: "everlast";
  created_at: string;
  mode: Mode;
  kind: string;
  route?: string;
  transcript: string;
  result: LlmResult;
};

export type SettingsSafe = {
  hotkey: string;
  apiKeyPresent: boolean;
  n8nWebhookUrl: string;
  n8nSecretPresent: boolean;
  sttLanguage: string;
  sttModel: string;
  sttTransport: string;
  hotkeyError?: string | null;
};

export type IpcEventMap = {
  "app.state": { state: AppState };
  "stt.delta": { textDelta: string };
  "stt.live": { liveText: string };
  "stt.final": { finalTranscript: string };
  "stt.error": { message: string };
  "llm.result": { json: LlmResult; mode: Mode; runId: number; coverage?: number | null };
  "llm.updatePreview": { json: LlmResult; mode: Mode; changeLog: ChangeLogEntry[]; token: string };
  "llm.updated": { json: LlmResult; mode: Mode; changeLog: ChangeLogEntry[]; runId: number; coverage?: number | null };
  "llm.error": { message: string };
  "settings.open": {};
  "record.start": {};
  "record.stop": {};
};

export type IpcInvokeMap = {
  "overlay.open": undefined;
  "overlay.hide": undefined;
  "settings.get": undefined;
  "settings.set": {
    apiKey?: string;
    n8nWebhookUrl?: string;
    n8nSharedSecret?: string;
    sttLanguage?: string;
    sttModel?: string;
    sttTransport?: string;
    hotkey?: string;
  };
  "settings.reset": undefined;
  "settings.open": undefined;
  "stt.start": undefined;
  "stt.audioFrame": { pcm16Buffer: ArrayBuffer };
  "stt.stop": undefined;
  "stt.realtimeCheck": undefined;
  "llm.enrich": { transcript: string; mode: Mode };
  "llm.update": { transcript: string; mode: Mode; previous: LlmResult; previousId?: number };
  "llm.applyUpdate": { token: string };
  "llm.discardUpdate": { token: string };
  "clipboard.copy": { text: string };
  "export.json": { data: unknown; suggestedName: string };
  "export.md": { markdown: string; suggestedName: string };
  "n8n.webhook": WebhookPayload;
  "history.list": { limit?: number };
  "history.get": { id: number };
  "history.rename": { id: number; name: string };
  "modes.list": undefined;
};

export const ipcClient = {
  isAvailable: () => typeof window !== "undefined" && typeof window.everlast !== "undefined",
  invoke: <K extends keyof IpcInvokeMap>(channel: K, payload?: IpcInvokeMap[K]) => {
    if (typeof window === "undefined" || typeof window.everlast === "undefined") {
      return Promise.reject(new Error("Electron IPC unavailable. Run the app via Electron."));
    }
    return window.everlast.invoke(channel as string, payload);
  },
  on: <K extends keyof IpcEventMap>(channel: K, handler: (payload: IpcEventMap[K]) => void) => {
    if (typeof window === "undefined" || typeof window.everlast === "undefined") {
      return () => undefined;
    }
    return window.everlast.on(channel as string, handler);
  }
};
