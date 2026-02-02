import { getApiKey, getSttLanguage, getSttModel, getSttTransport } from "./settings";
import { buildPrompt, resolveBatchModel } from "./sttModels";
import { RealtimeSttClient } from "./realtimeSttClient";
import { SttEvents } from "./sttTypes";

const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

class BatchSttClient {
  private chunks: Buffer[] = [];
  private events: SttEvents;
  private totalBytes = 0;

  constructor(events: SttEvents) {
    this.events = events;
  }

  async start() {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("OpenAI API key missing. Add it in Settings.");
    }
    this.chunks = [];
    this.totalBytes = 0;
  }

  appendAudio(pcm16Buffer: ArrayBuffer) {
    const chunk = Buffer.from(pcm16Buffer);
    if (chunk.length === 0) return;
    this.chunks.push(chunk);
    this.totalBytes += chunk.length;
  }

  async stop(): Promise<string> {
    if (this.chunks.length === 0) {
      return "";
    }

    if (this.totalBytes < MIN_RECORDING_BYTES) {
      this.chunks = [];
      this.totalBytes = 0;
      throw new Error("Recording too short (min 0.6s). Please speak a bit longer.");
    }

    const pcm = Buffer.concat(this.chunks);
    this.chunks = [];
    this.totalBytes = 0;

    const wav = createWavBuffer(pcm, SAMPLE_RATE, CHANNELS, BITS_PER_SAMPLE);

    try {
      const transcript = await transcribeWav(wav);
      return transcript.trim();
    } catch (err: any) {
      const message = err?.message ?? "Transcription failed.";
      this.events.onError(message);
      throw err;
    }
  }
}

export class SttClient {
  private batch: BatchSttClient;
  private realtime: RealtimeSttClient | null = null;
  private events: SttEvents;
  private activeTransport: "batch" | "realtime" = "batch";

  constructor(events: SttEvents) {
    this.events = events;
    this.batch = new BatchSttClient(events);
  }

  async start(): Promise<{ transport: "batch" | "realtime"; notice?: string }> {
    const transport = getSttTransport() === "realtime" ? "realtime" : "batch";
    this.activeTransport = transport;
    if (transport === "realtime") {
      this.realtime = new RealtimeSttClient(this.events);
      try {
        await this.realtime.start();
        return { transport: "realtime" };
      } catch (err: any) {
        const message = err?.message ?? "Realtime transcription unavailable.";
        if (shouldFallbackToBatch(message)) {
          this.realtime = null;
          this.activeTransport = "batch";
          await this.batch.start();
          return {
            transport: "batch",
            notice: `Realtime unavailable (${formatRealtimeNotice(message)}). Using Batch instead.`
          };
        }
        this.realtime = null;
        throw err;
      }
    }
    await this.batch.start();
    return { transport: "batch" };
  }

  appendAudio(pcm16Buffer: ArrayBuffer) {
    if (this.activeTransport === "realtime") {
      this.realtime?.appendAudio(pcm16Buffer);
      return;
    }
    this.batch.appendAudio(pcm16Buffer);
  }

  async stop(): Promise<string> {
    if (this.activeTransport === "realtime") {
      const transcript = await this.realtime?.stop();
      this.realtime = null;
      return transcript ?? "";
    }
    return this.batch.stop();
  }
}

async function transcribeWav(wav: Buffer) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API key missing. Add it in Settings.");
  }

  const language = getSttLanguage();
  const prompt = buildPrompt(language);
  const form = new FormData();
  const blob = new Blob([new Uint8Array(wav)], { type: "audio/wav" });
  form.append("file", blob, "audio.wav");
  form.append("model", resolveBatchModel(getSttModel()));
  form.append("response_format", "json");
  if (language && language !== "auto") {
    form.append("language", language);
  }
  if (prompt) {
    form.append("prompt", prompt);
  }

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI transcription error ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  return data?.text ?? "";
}

// prompt + model helpers are in sttModels.ts

function shouldFallbackToBatch(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not supported in realtime") ||
    normalized.includes("realtime mode") ||
    normalized.includes("not permitted") ||
    normalized.includes("not available") ||
    normalized.includes("access") ||
    normalized.includes("eai_again") ||
    normalized.includes("enotfound") ||
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("socket") ||
    normalized.includes("timeout") ||
    normalized.includes("connect")
  );
}

function formatRealtimeNotice(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("not supported in realtime") || normalized.includes("not permitted") || normalized.includes("access")) {
    return "This key/model does not have Realtime access";
  }
  if (normalized.includes("eai_again") || normalized.includes("enotfound")) {
    return "Network/DNS error reaching api.openai.com";
  }
  if (normalized.includes("timeout")) {
    return "Network timeout reaching api.openai.com";
  }
  return message;
}

function createWavBuffer(pcm: Buffer, sampleRate: number, channels: number, bitsPerSample: number) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  pcm.copy(buffer, 44);
  return buffer;
}

const MIN_RECORDING_MS = 600;
const MIN_RECORDING_BYTES = (SAMPLE_RATE * MIN_RECORDING_MS * CHANNELS * BITS_PER_SAMPLE) / 8000;
