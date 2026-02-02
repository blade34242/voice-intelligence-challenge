# Audio Quality & Transcription Pipeline

This document explains how audio is captured, converted, and sent to the STT API, plus the quality trade‑offs.

---

## Pipeline Overview
1. **Microphone capture** in the renderer using WebAudio.
2. **Downmix to mono** (1 channel).
3. **Resample to 24 kHz** (required for realtime, and used consistently for batch).
4. **Convert float32 → int16 PCM**.
5. **Send frames** to Electron main via IPC.
6. **Batch STT** builds a WAV (24 kHz / 16‑bit / mono) and uploads it.

---

## Why 24 kHz / 16‑bit / mono?
- **Realtime STT requires 24 kHz PCM** input.
- **Speech content** is mostly below 8 kHz, so 24 kHz is sufficient.
- **16‑bit PCM** is standard for STT and preserves enough dynamic range.

---

## Quality Impact (honest)
- **High frequencies >12 kHz** are removed (Nyquist at 24 kHz).
- For **voice**, this is typically acceptable.
- The current resampler is **linear** (simple + fast). It may introduce minor artifacts compared to a high‑quality DSP resampler.

---

## If you want higher fidelity (optional future)
1. **Batch STT with original sample rate** (e.g., 48 kHz WAV).
2. **Higher‑quality resampling** (DSP or OfflineAudioContext).
3. **Noise reduction / AGC** before conversion.

---

## Code Locations
- Capture + resample: `src/app/page.tsx`
- Batch STT upload: `electron/sttClient.ts`

