# Requirements Pack (Pre‑Analysis)
Kurzlink zurück zur Übersicht: `README.md`

Unten ist ein **komplettes Requirements-Engineering-Paket** für die Everlast-Challenge (Voice Intelligence Desktop App) – so, dass du daraus direkt **Backlog, Architektur und README** ableiten kannst.

---

## 1) Produktvision (Kurz)

**Ziel:** Eine Desktop-App, die per **Hotkey** sofort aufnahmebereit ist, Sprache in Text **transkribiert** und den Text via KI **anreichert** (z. B. strukturierte Notiz, Zusammenfassung, Action Items, formatierter Output), damit der Output **sofort weiterverwendbar** ist.

**Core-Flow:** Hotkey → Aufnahme → Transkription → Enrichment → Ergebnis kopierbar/exportierbar

---

## 2) Stakeholder & Nutzer

**Primäre Nutzer**

* Wissensarbeiter (Meetings, Notizen, Brainstorming)
* Entwickler/PM (Tickets, Status-Updates)
* Sales/Consulting (Call Notes, Follow-ups)

**Sekundäre Stakeholder**

* IT/Security (Datenschutz, Logging, API-Keys)
* Hiring-Team (Bewertung von Architektur/Qualität)

---

## 3) Use Cases (Top 6)

1. **Schnelle Notiz im Workflow**

   * User drückt Hotkey, spricht 15–60 Sekunden, bekommt strukturierte Notiz + Copy-to-Clipboard.
2. **Meeting-Zusammenfassung**

   * Aufnahme länger, Output: Summary + Decisions + Action Items.
3. **Ticket/Issue aus Sprache**

   * Output im Template: Title, Context, Steps, Expected/Actual, Priority.
4. **E-Mail-Entwurf**

   * Output: höflich, kurz, mit Bulletpoints.
5. **CRM/Call-Log**

   * Output: Gesprächszusammenfassung + Next steps + Risiko/Chance.
6. **Custom Prompt / Modus**

   * User wählt “Mode” (z. B. “Notiz”, “Mail”, “Ticket”, “Summary”).

---

## 4) Funktionale Anforderungen (FR)

### Aufnahme & Steuerung

* **FR-1:** App läuft als **Desktop-Anwendung** (Windows/macOS/Linux).
* **FR-2:** App ist per **globalem Hotkey** aktivierbar (auch wenn sie im Hintergrund ist).
* **FR-3:** Hotkey startet/stopt Aufnahme (Toggle) **oder** hält Aufnahme solange Taste gedrückt (Push-to-talk).
* **FR-4:** Visuelles Feedback: “Listening…” + Pegel/Timer.
* **FR-5:** Aufnahmeabbruch (Esc/Stop Button) ohne Ergebnis.

### Transkription

* **FR-6:** Audio wird nach Aufnahme **transkribiert** (lokal oder API).
* **FR-7:** Sprache auto-detect **oder** einstellbar (mind. Deutsch/Englisch).
* **FR-8:** Transkript ist sichtbar und editierbar (kleine Korrekturen möglich).
* **FR-9:** Fehlerfälle: kein Mic, Permission denied, Timeout → verständliche Meldung + Retry.

### Enrichment (KI-Anreicherung)

* **FR-10:** Enrichment läuft auf Basis des Transkripts über ein LLM (lokal oder API).
* **FR-11:** Mindestens 3 Modi:

  * Strukturierte Notiz
  * Zusammenfassung + Action Items
  * Formatierter Text (Markdown)
* **FR-12:** Ergebnis ist:

  * kopierbar (Clipboard)
  * optional exportierbar (Markdown/Text/JSON)
* **FR-13:** Prompt/Modus ist wählbar (Dropdown).
* **FR-14:** “Regenerate” (erneut anreichern) ohne neu aufnehmen.

### Historie & Speicherung (MVP optional, aber sehr hilfreich)

* **FR-15 (Nice-to-have):** Verlauf der letzten N Einträge lokal speichern (nur lokal).
* **FR-16 (Nice-to-have):** Suche/Filter im Verlauf.

### Setup/Config

* **FR-17:** API-Keys (falls genutzt) konfigurierbar via `.env` + UI-Hinweis.
* **FR-18:** Auswahl Transkriptions-Provider: lokal/API (Fallback).

---

## 5) Nicht-funktionale Anforderungen (NFR)

**Usability**

* **NFR-1:** “Time-to-First-Result” (Hotkey → Ergebnis) im Normalfall < 10–20s bei kurzer Aufnahme (abhängig von Provider).
* **NFR-2:** Bedienung mit Tastatur möglich (Hotkey, Stop, Copy).

**Performance**

* **NFR-3:** UI bleibt responsiv während Transkription/Enrichment (Async/Worker/Backend).
* **NFR-4:** Audio-Verarbeitung robust bei 30–60 Minuten Aufnahmen (mindestens chunking/limits definieren).

**Privacy/Security**

* **NFR-5:** Klarer Hinweis, ob Daten lokal verarbeitet oder an API gesendet werden.
* **NFR-6:** API-Keys nie ins Repo; sichere lokale Speicherung (OS Keychain/Secret Store) ideal.
* **NFR-7:** Logs ohne sensible Inhalte (keine Volltranskripte in Logs per Default).

**Reliability**

* **NFR-8:** Wiederholbare Verarbeitung (Retry-Mechanismen, Timeout-Handling).
* **NFR-9:** Graceful degradation: wenn Enrichment failt → zumindest Transkript liefern.

**Portability**

* **NFR-10:** Build & Run auf mind. einem OS clean; ideal cross-platform.

---

## 6) Scope (MVP vs. Stretch)

**MVP (sollte für Challenge reichen)**

* Desktop App (Next.js + Tauri/Electron)
* Global Hotkey
* Aufnahme (Start/Stop)
* Transkription (ein Provider)
* Enrichment (ein LLM)
* Output anzeigen + Copy
* README + Design Decisions

**Stretch**

* Multi-Modi + Custom Prompts
* Verlauf + Suche
* Offline Transkription (whisper.cpp) + Online fallback
* Streaming/Realtime partial transcript
* Auto-insert in aktive App (Paste-on-complete)

---

## 7) Architekturvorschlag (sauber + erklärbar)

### Empfehlung: **Tauri + Next.js**

* **Frontend (Next.js UI):** Aufnahme-Controls, Mode-Auswahl, Ergebnis-Ansicht, Verlauf.
* **Backend (Tauri/Rust):**

  * Global Hotkey
  * Audio Capture / Device Zugriff
  * Datei-/Buffer-Handling
  * Aufruf Transkription (lokal oder API)
  * Aufruf LLM (API oder lokal)
  * sichere Speicherung (optional)

### Datenfluss (Pipeline)

1. Hotkey Event → UI öffnet “Listening Panel”
2. Audio Recorder → WAV/PCM Buffer
3. Transkription Service → `transcript.text`
4. Enrichment Service (LLM) → `output (markdown/json)`
5. UI zeigt Ergebnis → Copy/Export/Save

### Komponenten (logisch)

* `HotkeyService`
* `AudioService`
* `TranscriptionService` (Interface, Provider austauschbar)
* `EnrichmentService` (Interface, Prompt Modes)
* `StorageService` (optional)
* `Telemetry/Logging` (minimal)

---

## 8) Prompt-/Mode-Design (Enrichment konkret machen)

**Mode: “Structured Note”**

* Output: Titel, Kernaussagen, Kontext, offene Fragen

**Mode: “Meeting Summary”**

* Output: Summary, Decisions, Action Items (Owner, Due Date optional), Risks

**Mode: “Ticket”**

* Output: Title, Context, Steps to Reproduce, Expected, Actual, Severity, Labels

Technisch: `mode` → Prompt Template + ggf. JSON Schema (wenn du “structured output” zeigen willst).

---

## 9) Akzeptanzkriterien (knallhart, challenge-ready)

* App startet lokal, zeigt UI.
* Hotkey funktioniert global (nachweisbar im Video).
* Nach Aufnahme kommt **immer** mindestens ein Transkript oder eine Fehlermeldung mit Retry.
* Enrichment liefert formatierten Output (z. B. Markdown).
* Copy-to-Clipboard funktioniert.
* README: Setup + Architektur + Design-Entscheidungen.

---

## 10) README-Outline (direkt verwendbar)

**README**

1. Problem & Ziel
2. Features (Hotkey, Aufnahme, Transkription, Enrichment, Copy)
3. Demo (kurz beschreiben, Link zum Video)
4. Architektur

   * Stack
   * Pipeline Diagramm
   * Provider-Entscheidungen
5. Setup

   * Voraussetzungen
   * `.env` Beispiel
   * `npm install`, `npm run dev`, `tauri dev` / `electron`
6. Design Decisions

   * Warum Tauri/Electron
   * Warum Transkriptionsprovider
   * Warum LLM-Provider
   * Privacy/Logging
7. Known Limitations
8. Next Steps

---

## 11) Backlog (User Stories – klein und umsetzbar)

1. **Als User** möchte ich per Hotkey die Aufnahme starten/stoppen, **damit** ich ohne Kontextwechsel diktieren kann.
2. **Als User** möchte ich während Aufnahme Feedback sehen (Timer/Pegel), **damit** ich weiß, dass es läuft.
3. **Als User** möchte ich ein Transkript erhalten, **damit** ich den Inhalt prüfen kann.
4. **Als User** möchte ich einen Modus wählen (Notiz/Summary/Ticket), **damit** der Output passend formatiert ist.
5. **Als User** möchte ich das Ergebnis kopieren können, **damit** ich es sofort irgendwo einfügen kann.
6. **Als User** möchte ich bei Fehlern eine klare Meldung + Retry, **damit** ich nicht hängen bleibe.

