import WebSocket from "ws";
import { getApiKey, getSttLanguage, getSttModel } from "./settings";
import { buildPrompt, isRealtimeModel, resolveRealtimeModel } from "./sttModels";
import { SttEvents } from "./sttTypes";

const SAMPLE_RATE = 24000;
const BYTES_PER_SAMPLE = 2;
const BYTES_PER_MS = (SAMPLE_RATE * BYTES_PER_SAMPLE) / 1000;
const MIN_BUFFER_MS = 100;
const MIN_BUFFER_BYTES = MIN_BUFFER_MS * BYTES_PER_MS;
const MIN_RECORDING_MS = 600;
const MIN_RECORDING_BYTES = MIN_RECORDING_MS * BYTES_PER_MS;
const COMMIT_INTERVAL_MS = 900;
const CLOSE_WAIT_MS = 900;

type RealtimeEvent =
  | { type: "conversation.item.input_audio_transcription.delta"; delta?: string }
  | { type: "conversation.item.input_audio_transcription.completed"; transcript?: string }
  | { type: "error"; error?: { message?: string } }
  | { type: string };

export class RealtimeSttClient {
  private events: SttEvents;
  private ws: WebSocket | null = null;
  private commitTimer: NodeJS.Timeout | null = null;
  private bufferedBytes = 0;
  private totalBytes = 0;
  private finalTranscript = "";
  private liveSuffix = "";
  private isClosing = false;
  private hasErrored = false;
  private lastErrorMessage = "";
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((err: Error) => void) | null = null;
  private startupSettled = false;
  private startupTimer: NodeJS.Timeout | null = null;

  constructor(events: SttEvents) {
    this.events = events;
  }

  async start() {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("OpenAI API key missing. Add it in Settings.");
    }

    this.finalTranscript = "";
    this.liveSuffix = "";
    this.bufferedBytes = 0;
    this.totalBytes = 0;
    this.isClosing = false;
    this.hasErrored = false;
    this.lastErrorMessage = "";
    this.startupSettled = false;
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }

    const model = resolveRealtimeModel(getSttModel());
    const wsUrl = buildRealtimeWsUrl();

    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    this.ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    this.ws.on("open", () => {
      this.sendSessionUpdate(model);
      this.startupTimer = setTimeout(() => {
        if (!this.startupSettled) {
          this.startupSettled = true;
          this.readyResolve?.();
        }
      }, 600);
    });

    this.ws.on("message", (data) => {
      const raw = data.toString();
      let event: RealtimeEvent | null = null;
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }
      if (!event) return;
      this.handleEvent(event);
    });

    this.ws.on("error", (err) => {
      if (this.readyReject) {
        this.readyReject(err as Error);
        this.readyReject = null;
      }
      this.reportError("Realtime connection error.");
    });

    this.ws.on("close", (code, reason) => {
      if (this.isClosing) return;
      const suffix = reason ? ` (${reason.toString()})` : "";
      const fallback = "Realtime transcription closed. Check model access or switch to Batch.";
      const message = this.lastErrorMessage || `Realtime connection closed (code ${code})${suffix}.`;
      if (!this.startupSettled && this.readyReject) {
        this.startupSettled = true;
        this.readyReject(new Error(message || fallback));
        return;
      }
      this.reportError(message || fallback);
    });

    await this.readyPromise;
    this.commitTimer = setInterval(() => this.commitIfReady(), COMMIT_INTERVAL_MS);
  }

  appendAudio(pcm16Buffer: ArrayBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const chunk = Buffer.from(pcm16Buffer);
    if (chunk.length === 0) return;
    const base64Audio = chunk.toString("base64");
    this.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64Audio }));
    this.bufferedBytes += chunk.length;
    this.totalBytes += chunk.length;
  }

  async stop(): Promise<string> {
    if (this.commitTimer) {
      clearInterval(this.commitTimer);
      this.commitTimer = null;
    }

    if (this.totalBytes < MIN_RECORDING_BYTES) {
      this.isClosing = true;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
        this.ws.close();
      }
      this.ws = null;
      throw new Error("Recording too short (min 0.6s). Please speak a bit longer.");
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.bufferedBytes >= MIN_BUFFER_BYTES) {
        this.commitBuffer();
      } else {
        this.ws.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
      }
    }

    await new Promise((resolve) => setTimeout(resolve, CLOSE_WAIT_MS));
    this.isClosing = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;

    return this.finalTranscript.trim();
  }

  private sendSessionUpdate(model: string) {
    if (!this.ws) return;
    const language = getSttLanguage();
    const prompt = buildPrompt(language);
    const transcription: Record<string, string> = {
      model
    };
    if (language && language !== "auto") {
      transcription.language = language;
    }
    if (prompt) {
      transcription.prompt = prompt;
    }

    this.ws.send(
      JSON.stringify({
        type: "transcription_session.update",
        session: {
          input_audio_format: "pcm16",
          input_audio_transcription: transcription,
          turn_detection: null,
          input_audio_noise_reduction: null
        }
      })
    );
  }

  private commitIfReady() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.bufferedBytes < MIN_BUFFER_BYTES) return;
    this.commitBuffer();
  }

  private commitBuffer() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    this.ws.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
    this.bufferedBytes = 0;
  }

  private handleEvent(event: RealtimeEvent) {
    if (event.type === "conversation.item.input_audio_transcription.delta" && "delta" in event) {
      const delta = event.delta ?? "";
      if (!delta) return;
      this.liveSuffix += delta;
      this.events.onDelta(delta);
      this.events.onLive(`${this.finalTranscript}${this.liveSuffix}`);
      return;
    }
    if (event.type === "conversation.item.input_audio_transcription.completed" && "transcript" in event) {
      const transcript = event.transcript ?? "";
      if (!transcript) return;
      this.finalTranscript = joinText(this.finalTranscript, transcript);
      this.liveSuffix = "";
      this.events.onLive(this.finalTranscript);
      return;
    }
    if (event.type === "error" && "error" in event) {
      const message = event.error?.message ?? "Realtime transcription error.";
      if (!this.startupSettled && this.readyReject) {
        this.startupSettled = true;
        this.readyReject(new Error(message));
        return;
      }
      this.reportError(message);
    }
  }

  private reportError(message: string) {
    this.lastErrorMessage = message;
    if (this.hasErrored) return;
    this.hasErrored = true;
    this.events.onError(message);
  }
}

function joinText(base: string, next: string) {
  if (!base) return next.trim();
  if (!next) return base.trim();
  return `${base.trim()} ${next.trim()}`;
}

export async function checkRealtimeAccess(): Promise<{ ok: boolean; message: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, message: "OpenAI API key missing. Add it in Settings." };
  }

  const selectedModel = getSttModel();
  if (!isRealtimeModel(selectedModel)) {
    return {
      ok: false,
      message: "Selected model does not support Realtime. Choose gpt-4o-mini-transcribe or gpt-4o-transcribe."
    };
  }

  const model = resolveRealtimeModel(selectedModel);
  const wsUrl = buildRealtimeWsUrl();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean, message: string) => {
      if (settled) return;
      settled = true;
      resolve({ ok, message });
    };

    const ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    const timeout = setTimeout(() => {
      finish(true, "Realtime available (no errors after commit).");
      ws.close();
    }, 2200);

    ws.on("open", () => {
      const language = getSttLanguage();
      const prompt = buildPrompt(language);
      const transcription: Record<string, string> = { model };
      if (language && language !== "auto") {
        transcription.language = language;
      }
      if (prompt) {
        transcription.prompt = prompt;
      }
      ws.send(
        JSON.stringify({
          type: "transcription_session.update",
          session: {
            input_audio_format: "pcm16",
            input_audio_transcription: transcription,
            turn_detection: null,
            input_audio_noise_reduction: null
          }
        })
      );

      setTimeout(() => {
        if (settled || ws.readyState !== WebSocket.OPEN) return;
        const silence = Buffer.alloc(MIN_BUFFER_BYTES);
        ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: silence.toString("base64") }));
        ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        ws.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
      }, 200);
    });

    ws.on("message", (data) => {
      let event: RealtimeEvent | null = null;
      try {
        event = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!event) return;
      if (event.type === "error" && "error" in event) {
        clearTimeout(timeout);
        const rawMessage = event.error?.message ?? "Realtime error.";
        const friendly = friendlyRealtimeError(rawMessage);
        finish(false, friendly);
        ws.close();
        return;
      }
      if (
        event.type === "conversation.item.input_audio_transcription.completed" ||
        event.type === "conversation.item.input_audio_transcription.delta" ||
        event.type === "input_audio_buffer.committed"
      ) {
        clearTimeout(timeout);
        finish(true, "Realtime available.");
        ws.close();
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      finish(false, friendlyRealtimeError(err?.message ?? "Realtime connection error."));
    });

    ws.on("close", (code, reason) => {
      if (settled) return;
      clearTimeout(timeout);
      const suffix = reason ? ` (${reason.toString()})` : "";
      finish(false, friendlyRealtimeError(`Realtime closed (code ${code})${suffix}.`));
    });
  });
}

function buildRealtimeWsUrl() {
  return "wss://api.openai.com/v1/realtime?intent=transcription";
}

function friendlyRealtimeError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("not supported in realtime") || normalized.includes("not permitted") || normalized.includes("access")) {
    return "Realtime access is not enabled for this key/model.";
  }
  if (normalized.includes("eai_again") || normalized.includes("enotfound")) {
    return "Network/DNS error reaching api.openai.com.";
  }
  if (normalized.includes("timeout")) {
    return "Network timeout reaching api.openai.com.";
  }
  return message;
}
