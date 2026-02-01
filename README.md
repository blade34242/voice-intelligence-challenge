# Everlast Voice Intelligence (Desktop App)

**Kurzbeschreibung (vollständig):**  
Everlast Voice Intelligence ist ein Desktop‑Tool, das Sprache aufnimmt, **transkribiert** und die Inhalte **strukturiert aufbereitet**. Du kannst Ergebnisse **direkt bearbeiten**, als **Follow‑Up** mit neuen Transkripten **aktualisieren** (inkl. **Diff/Change‑Log**), und anschließend per **Webhook** oder Export weiterverarbeiten. Ziel: weniger Nacharbeit und sofort nutzbare, strukturierte Daten aus Sprache.

## Kurzbeschreibung des Problems
Voice‑Notizen sind schnell, aber rohe Transkripte sind unstrukturiert und schwer weiterzuverarbeiten. Für Kalender‑Events, E‑Mails, Tickets oder Notizen braucht es meist manuelle Nacharbeit und Tool‑Wechsel.

## Lösung (MVP)
Eine Desktop‑Overlay‑App (Electron + Next.js), die per Hotkey gestartet wird, Sprache aufnimmt, transkribiert und anschließend in **strukturierte Daten** umwandelt.  
Zusätzlich unterstützt sie **Inline‑Editing**, **Follow‑Up Updates** mit **sichtbarem Diff**, sowie **Webhook‑Integration** für nachgelagerte Automationen.

Ablauf: **Hotkey → Aufnahme → Transkription → Enrichment → Ergebnis (event/email/note/ticket)**

---

## Architektur‑Überblick

### Electron Main (Privileged)
- Globaler Hotkey
- Tray + Overlay‑Window
- Audio‑Transkription (non‑realtime, HTTP)
- LLM‑Enrichment (Responses API)
- Clipboard + Datei‑Export
- Settings (API‑Key, Webhook, Sprache)
- **SQLite History** (Runs, Follow‑Ups, Change‑Log)

### Preload (Sicherer IPC‑Bridge)
- `contextBridge` mit whitelisted IPC‑Calls
- Renderer hat **keinen** direkten Zugriff auf FS/Keys; Netzwerkzugriff ist browserseitig möglich, wird aber nicht genutzt

### Renderer (Next.js)
- UI‑Overlay (Start/Stop, Status, Tabs)
- Audio Capture (WebAudio → PCM16 @ 24kHz)
- Zeigt strukturierte Ergebnisse (Summary, Details, Actions)

### Data Flow
1. Hotkey startet/stoppt Aufnahme
2. Renderer sendet PCM16‑Frames per IPC
3. Main sammelt Audio und sendet an STT API
4. Ergebnis wird klassifiziert (Auto‑Mode)
5. LLM liefert **strukturierte JSON‑Daten**
6. UI zeigt Summary/Details/Actions + Export/Webhook
7. Run wird in SQLite gespeichert (inkl. Follow‑Up & Change‑Log)

---

## Setup

### Voraussetzungen
- Node.js (empfohlen: **22+** via nvm)
- OpenAI API Key

### Installation
```bash
npm install
```

### Start (Dev)
```bash
npm run dev
```

### Build / Pack (optional)
```bash
npm run build
npm run pack
```

### Self‑Build (Linux / Windows)
Wenn du die App selbst bauen willst, beachte die OS‑Unterschiede:

**Linux**
```bash
npm install
npm run build
npm run pack
```

**Windows**
```powershell
npm install
npm run rebuild:electron
npm run build
npm run pack
```

Hinweise:
- Windows braucht evtl. **Build Tools** für native Module (z. B. `better-sqlite3`).
- Cross‑Builds sind nicht zuverlässig: Windows‑Installer → Windows bauen, Linux‑Artefakte → Linux bauen.

---

## Design‑Entscheidungen

### 1) Hotkey steuert Aufnahme
- Hotkey **startet** Aufnahme
- Hotkey **stoppt** Aufnahme
- Fenster kann per Tray/App‑Icon geöffnet werden

### 2) Non‑Realtime STT (stabiler als Beta‑Realtime)
- Audio wird gesammelt und nach Stop transkribiert
- Stabiler, kein Realtime‑Beta notwendig

### 3) Strukturierter Output statt Markdown
- Ergebnis kommt als **strukturierte Objekte**
- Besser für n8n/Integrationen

### 4) Auto‑Mode + Override
- LLM entscheidet: **event / email / note / ticket**
- User kann im UI mit Dropdown **neu klassifizieren**

---

## Erweiterungen gegenüber dem ursprünglichen Plan (warum?)
Wir haben den Plan gezielt erweitert, um **Stabilität**, **Nutzbarkeit** und **Demo‑Qualität** zu erhöhen:
- **Editierbarer Hotkey:** Systeme belegen Hotkeys unterschiedlich → weniger Konflikte.
- **Transcription‑Model Auswahl:** Performance vs. Qualität flexibel wählbar.
- **Webhook‑Export + Payload‑Doku:** spätere Automationen (n8n) einfacher.
- **Inline‑Transcript‑Edit + Re‑Run:** Korrekturen ohne Neuaufnahme.
- **Follow‑Up Updates mit Change‑Log:** Folge‑Transkripte aktualisieren vorhandene Daten und zeigen Änderungen.
- **SQLite‑Verlauf mit Namen:** Runs können benannt und geladen werden.
- **Configurable Modes (JS/TS + Zod):** Felder sind per Schema definierbar, sicher validiert und flexibel erweiterbar.


## Modell‑Auswahl (warum?)
Mehrere STT‑Modelle ermöglichen **Speed vs. Accuracy** je nach Gerät und Aufnahme:
- `gpt-4o-mini-transcribe` → schnell & günstig
- `gpt-4o-transcribe` → höhere Genauigkeit
- `whisper-1` → Legacy/Fallback

---

## Configurable Modes (JS/TS + Zod)
Modes werden in `electron/modes/*.ts` definiert. Jeder Mode liefert:
- `id`, `label`, `description`, `route`
- **Zod‑Schema** (`dataSchemaZod`) und **JSON‑Schema** (`dataSchemaJson`)
- `system` + `userHint` für den LLM‑Prompt

Die App lädt beim Start **alle Mode‑Dateien** aus diesem Ordner und nutzt sie:
- für die Dropdown‑Auswahl im UI
- für die LLM‑Validierung (Schema)

---

##Prompts:
- Basis‑Prompt & LLM‑Aufruf: `electron/enrichLlm.ts`  
- Mode‑Prompts (system + userHint): `electron/modes/*.ts`

Warum JS/TS statt JSON?
- **Stabile Validierung** mit Zod
- **Compile‑time Sicherheit**
- Bessere Fehlererkennung bei Schema‑Änderungen

---

## Wie man mit Erweiterungen noch mehr Nutzen bekommt
**Kurzfazit:** Der Nutzen steigt stark, sobald das Ergebnis **automatisch weiterverarbeitet** wird und der Nutzer **weniger Nacharbeit** hat.

**Wirkungsvollste Erweiterungen**
- **Direkte Integrationen:** Kalender‑Eintrag, E‑Mail‑Entwurf, Ticket‑Erstellung (n8n/Apps)
- **Feld‑Korrektur‑UI:** Datum/Uhrzeit/Empfänger schnell bestätigen oder anpassen
- **Ziel‑Vorlagen:** Pro Team ein fixes Format (z. B. Sales‑Follow‑up, Bug‑Ticket, Meeting‑Notes)
- **Verlauf + Suche:** Schnell wiederfinden, wiederverwenden, exportieren
- **Automatisches Routing:** `kind`/`mode` steuert Workflows ohne UI‑Eingriff

**Warum das hilft**
- Minimiert Kontext‑Switching
- Erhöht Vertrauen durch klare Felder
- Spart echte Zeit in den Folgesystemen

---

## Output‑Struktur (Schema)
Die vollständige Schema‑Definition **inkl. Beispiele für alle Typen** steht hier:  
`docs/webhook-payloads.md`

---

## n8n Webhook
Details & Beispiele: `docs/n8n-webhook.md`

---

## Einstellungen
- OpenAI API Key
- Transcription Model (gpt-4o-mini-transcribe / gpt-4o-transcribe / whisper-1)
- Hotkey (editierbar, System‑abhängig)
- Sprache für Transkription (Auto / de / en / fr / it / es)
- Optional: Webhook URL + Secret

---

## Troubleshooting / Bekannte Probleme
Details: `docs/troubleshooting.md`

---

## Demo‑Flow (Kurz)
1. App starten (Tray sichtbar)
2. Hotkey → Aufnahme starten
3. Sprechen
4. Hotkey oder Stop → Transkription + Enrichment
5. Ergebnis prüfen → Copy/Export/Webhook

---

## Links
- Homepage: https://gellert-innovation.com
- Online CV: https://alex.gellert-innovation.com
- Blog: https://blog.gellert-innovation.com

## Projekt‑Dokumente
- Codex Prompt & UI‑Plan: `docs/codex-plan.md`
- Requirements/Pre‑Analysis: `docs/requirements-pack.md`
- Security Notes: `docs/security-notes.md`
