const BATCH_MODELS = new Set(["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"]);
const REALTIME_MODELS = new Set(["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "gpt-4o-transcribe-latest"]);

export function resolveBatchModel(model: string) {
  return BATCH_MODELS.has(model) ? model : "gpt-4o-mini-transcribe";
}

export function resolveRealtimeModel(model: string) {
  return REALTIME_MODELS.has(model) ? model : "gpt-4o-mini-transcribe";
}

export function isRealtimeModel(model: string) {
  return REALTIME_MODELS.has(model);
}

export function buildPrompt(language: string) {
  return "";
}
