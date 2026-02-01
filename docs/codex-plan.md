# Codex Plan (Original Prompt)
Kurzlink zurück zur Übersicht: `README.md`

Hier ist ein **kompletter, eindeutiger Codex-Plan** (inkl. **Screens / UI-Layout**) für eure Everlast-Desktop-App – basierend auf euren Entscheidungen:

* **1A:** Hotkey öffnet nur Overlay (kein Auto-Record)
* **2A:** Aufnahme via Start/Stop Button
* **3B:** LLM liefert **JSON nach Schema**, UI rendert daraus Tabs
* **+ Live-Transcription** via **OpenAI Realtime Transcription (WebSocket)** ([OpenAI Platform][1])

> Copy-paste den folgenden Block in Codex.

```text
PROJECT: Everlast Voice Intelligence Desktop App (Contest Build)
ROLE: You are a senior engineer. Build a production-grade MVP repo.

GOAL (must match briefing):
Desktop app (Electron) using Next.js UI that records microphone audio, transcribes it (live/streaming), then enriches via LLM into directly usable output. User can start app, press hotkey to open overlay, start/stop recording, see live transcript, then get enriched result, copy/export.

NON-NEGOTIABLES:
- Electron + Next.js base
- Global hotkey opens/focuses overlay ONLY (Decision 1A)
- Recording starts/stops with Start/Stop button (Decision 2A)
- STT is streaming (live transcript grows while speaking) using OpenAI Realtime Transcription over WebSocket
- Enrichment returns STRICT JSON validated by Zod (Decision 3B), then UI renders tabs
- Must be usable end-to-end with clear states, errors, retry
- No DB, no RAG, no n8n dependency. But design webhook adapter for later (disabled unless configured).

REFERENCE BEHAVIOR (OpenAI realtime transcription):
- Realtime transcription uses WebSocket/WebRTC; transcription is produced when audio buffer is committed; if VAD enabled server can decide commits. (We’ll do explicit commit timer.) 
- Listen for delta + completed transcription events and update UI live.
(See: OpenAI Realtime Transcription + Realtime WebSocket + client-events docs.)

------------------------------------------------------------
A) UX / SCREENS (make these exact screens)
------------------------------------------------------------

SCREEN 0: Tray (App running in background)
- When user closes window (X), app minimizes to tray (still running).
- Tray menu:
  - "Open Overlay"
  - "Settings"
  - "Quit"

SCREEN 1: Overlay (IDLE / READY)
Small always-available overlay window (center or top-right).
Layout:
-------------------------------------------------
| Everlast Voice Intelligence             [x]   |
| Status: Ready                                  |
| Mode: [Dropdown: Note | Meeting | Ticket]      |
|-----------------------------------------------|
| Live Transcript (empty / placeholder)          |
| "Press Start and speak..."                     |
|-----------------------------------------------|
| [ Start Recording ]      [ Settings ⚙ ]        |
-------------------------------------------------
Rules:
- Global hotkey shows/focuses this overlay.
- Start button begins recording + live transcription.

SCREEN 2: Overlay (RECORDING + LIVE TRANSCRIPT)
-------------------------------------------------
| Everlast Voice Intelligence             [x]   |
| Status: Listening...   Timer: 00:12            |
| Mode: [Dropdown ...] (editable during record)  |
|-----------------------------------------------|
| Live Transcript (grows as deltas arrive)       |
|  "We should schedule a call next week..."      |
|-----------------------------------------------|
| [ Stop Recording ]                             |
-------------------------------------------------
Rules:
- Transcript updates continuously from STT deltas.
- Stop ends capture; app finalizes transcript.

SCREEN 3: Overlay (PROCESSING: FINALIZE + ENRICH)
-------------------------------------------------
| Status: Finalizing transcript... / Enriching...|
| Spinner + short hint "Generating draft..."      |
| Keep transcript visible (last live text).       |
-------------------------------------------------

SCREEN 4: Overlay (RESULT: Tabs + Copy)
-------------------------------------------------
| Status: Done                                   |
| Mode: [Dropdown ...]  [Regenerate] (optional)  |
|------------------------------------------------|
| Tabs: [Transcript] [Draft] [Actions]           |
|------------------------------------------------|
| Transcript tab: clean_transcript                |
| Draft tab: final_markdown rendered (Markdown)   |
| Actions tab: checkboxes + Decisions/Risks/Qs    |
|------------------------------------------------|
| [ Copy Draft ] [ Export JSON ] [ Export MD ]    |
| [ Close ]                                       |
-------------------------------------------------
Copy rules:
- Copy Draft copies final_markdown.
- Export JSON writes the validated JSON file.
- Export MD writes final_markdown.

SCREEN 5: Settings modal/page (minimal)
Fields:
- OPENAI_API_KEY (input; store safely; never expose to renderer)
- Hotkey display (read-only for MVP) e.g. Ctrl+Shift+Space
- Optional (future): N8N_WEBHOOK_URL, N8N_SHARED_SECRET (disabled by default)
Buttons:
- Save
- Test Connection (optional)
Errors shown inline.

------------------------------------------------------------
B) STATE MACHINE (strict)
------------------------------------------------------------
States (renderer UI):
- idle
- recording
- finalizing_transcript
- enriching
- done
- error

Transitions:
idle -> recording (Start)
recording -> finalizing_transcript (Stop)
finalizing_transcript -> enriching (final transcript ready)
enriching -> done (LLM ok)
any -> error (show message + retry options)
error -> idle (Reset)

------------------------------------------------------------
C) ARCHITECTURE (Electron best practice)
------------------------------------------------------------
- Main process: privileged operations
  - Global hotkey registration
  - Overlay window show/hide/focus
  - OpenAI Realtime STT WebSocket client
  - OpenAI LLM enrichment HTTP call
  - Clipboard + file export
  - Settings storage (electron-store or OS keychain if available)

- Preload: contextBridge exposes narrow IPC API only
- Renderer (Next.js): UI, Audio capture via WebAudio, sends PCM frames to main

Security:
- contextIsolation true
- nodeIntegration false
- no direct fs/network from renderer
- key never in renderer

------------------------------------------------------------
D) AUDIO CAPTURE (Renderer)
------------------------------------------------------------
Implement AudioWorklet (preferred) to capture mic stream as float32.
Convert pipeline:
- downmix to mono
- resample to 24kHz
- convert float32 -> int16 PCM (little-endian)
Send frames every ~20ms to main via IPC as ArrayBuffer (Int16Array buffer).

Fallback if AudioWorklet not available: ScriptProcessorNode.

------------------------------------------------------------
E) OPENAI REALTIME STT (Main via ws)
------------------------------------------------------------
Implement a WS client to OpenAI Realtime Transcription session.
- Connect using OpenAI realtime websocket guidance.
- Configure transcription session (model: gpt-4o-mini-transcribe).
- Streaming:
  - On each audio frame: send input_audio_buffer.append with base64(audio bytes)
  - Every 800–1200ms: send input_audio_buffer.commit to trigger transcription generation
  - Optionally input_audio_buffer.clear after commit to keep chunks clean
- Receive events:
  - delta events -> forward incremental text to renderer
  - completed events -> finalize chunk text
Assemble live text:
- Keep a buffer string for current chunk deltas
- Append completed chunk to final transcript with spacing
On Stop:
- stop sending frames
- final commit
- wait briefly for last completed events
- finalize transcript and proceed to enrichment

Error handling:
- WS reconnect is optional; for MVP show error + "Retry STT" button.
- If key invalid/401/403 -> show Settings link.

------------------------------------------------------------
F) ENRICHMENT (OpenAI HTTP, JSON schema)
------------------------------------------------------------
3 modes:
1) NOTE (Structured note)
2) MEETING (Summary + actions)
3) TICKET (Bug/Issue format)

Use Structured Outputs approach:
- Prompt must demand strict JSON matching schema.
- Validate with Zod in main.
- If validation fails: retry once with "Fix JSON to match schema" instruction.
- If still fails: return error but still provide clean transcript.

BASE JSON SCHEMA (Zod):
{
  clean_transcript: string,
  final_markdown: string,
  action_items: { text: string }[],
  decisions: string[],
  risks: string[],
  questions: string[],
  title?: string,
  tags?: string[]
}
TICKET additional:
{
  ticket: {
    title: string,
    context: string,
    steps: string[],
    expected: string,
    actual: string,
    severity: "low"|"medium"|"high"
  }
}
Renderer should render Draft tab from final_markdown; Actions tab from action_items + decisions/risks/questions.

------------------------------------------------------------
G) IPC CONTRACT (typed)
------------------------------------------------------------
Renderer -> Main:
- overlay.open()
- stt.start()
- stt.audioFrame({ pcm16Buffer, sampleRate: 24000 })
- stt.stop()
- llm.enrich({ transcript, mode })
- clipboard.copy({ text })
- export.json({ data, suggestedName })
- export.md({ markdown, suggestedName })
- settings.get()
- settings.set()

Main -> Renderer:
- app.state({ state })
- stt.delta({ textDelta })
- stt.live({ liveText })  // optional convenience
- stt.final({ finalTranscript })
- stt.error({ message })
- llm.result({ json })
- llm.error({ message })

------------------------------------------------------------
H) FILE/REPO STRUCTURE (must produce)
------------------------------------------------------------
/electron
  main.ts
  preload.ts
  ipcMainHandlers.ts
  realtimeStt.ts
  enrichLlm.ts
  settings.ts
/src
  /app (or /pages)
  /components
    OverlayShell.tsx
    RecorderPanel.tsx
    TabsView.tsx
    SettingsModal.tsx
  /lib
    ipcClient.ts
    modes.ts
    schemas.ts
/README.md
/.env.example
/package.json
/tsconfig.json

Deps (suggest):
- electron, next, react, typescript
- ws (websocket client in main)
- zod
- electron-store (settings)
- react-markdown (render final_markdown)
- concurrently (dev script)

Dev scripts:
- npm run dev (Next + Electron concurrently)
- npm run build
- npm run pack (electron-builder or forge)

------------------------------------------------------------
I) README (required sections)
------------------------------------------------------------
- Problem statement + solution
- Architecture overview (main/renderer, streaming STT, enrichment)
- Setup: install, env, run
- Design decisions: Hotkey 1A, Start/Stop 2A, JSON schema 3B, why streaming STT
- Known limitations
- Demo instructions (what to show in video)

------------------------------------------------------------
J) ACCEPTANCE TESTS
------------------------------------------------------------
- App starts, tray exists, hotkey opens overlay.
- Start -> live transcript visibly updates while speaking.
- Stop -> transcript finalizes, enrichment runs, tabs show output.
- Copy Draft copies markdown.
- Export JSON/MD writes files.
- If STT fails -> error shown + retry.
- If LLM fails -> transcript still shown + retry enrichment.

DELIVER:
Complete repo with all features above, minimal styling, robust error handling, strongly typed IPC, no secrets in renderer.
```

