# Webhook Payloads (Schema + Examples)

Diese Datei beschreibt **genau** das JSON, das an n8n gesendet wird (und auch per „Export Webhook JSON“ exportiert werden kann).

## Basis‑Payload (Envelope)
```json
{
  "source": "everlast",
  "created_at": "2026-01-31T12:00:00.000Z",
  "mode": "event",
  "kind": "calendar",
  "route": "calendar",
  "transcript": "…",
  "result": { /* siehe Output‑Schema */ }
}
```

### Felder (Envelope)
- `source`: Immer `"everlast"`
- `created_at`: ISO‑Timestamp
- `mode`: Klassifikation (Mode‑ID)
- `kind`: Normalisiert für Routing (z. B. `calendar`, `email`)
- `route`: optional, expliziter Routing‑Ziel‑Name
- `transcript`: Rohes Transkript
- `result`: Strukturierter Output (siehe unten)

---

## Output‑Schema (Result)
Der Output besteht aus einem **stabilen Envelope** plus einem **Mode‑spezifischen `data`‑Objekt**.

```json
{
  "clean_transcript": "…",
  "summary": "…",
  "actions": ["…"],
  "tags": ["…"],
  "data": { "..." : "..." }
}
```

### Event
```json
{
  "clean_transcript": "Das Sommerfest startet am Freitag um 18 Uhr im Stadtpark.",
  "summary": "Sommerfest am Freitag 18:00 im Stadtpark.",
  "actions": ["Kalendereintrag erstellen"],
  "tags": ["event", "sommerfest"],
  "data": {
    "title": "Sommerfest",
    "date": "2026-06-12",
    "time": "18:00",
    "timezone": "Europe/Zurich",
    "location": "Stadtpark",
    "attendees": ["team@company.com"],
    "duration_minutes": 120,
    "description": "Sommerfest mit Team und Grill.",
    "reminders": ["30 minutes before"]
  }
}
```

### Email
```json
{
  "clean_transcript": "Schreib Tom, dass wir den Termin auf nächste Woche verschieben.",
  "summary": "E‑Mail an Tom: Terminverschiebung auf nächste Woche.",
  "actions": ["E‑Mail senden"],
  "tags": ["email"],
  "data": {
    "subject": "Termin verschieben",
    "body": "Hi Tom, können wir den Termin auf nächste Woche verschieben?",
    "to": ["tom@company.com"],
    "cc": [],
    "bcc": [],
    "intent": "request",
    "tone": "friendly"
  }
}
```

### Note
```json
{
  "clean_transcript": "Das Meeting war gut, nächste Schritte sind A und B.",
  "summary": "Meeting‑Notiz mit nächsten Schritten.",
  "actions": ["A umsetzen", "B umsetzen"],
  "tags": ["note"],
  "data": {
    "title": "Meeting Notizen",
    "summary": "Meeting war positiv, nächste Schritte A und B.",
    "bullets": [
      "Meeting war positiv",
      "Nächste Schritte: A, B"
    ],
    "action_items": ["A umsetzen", "B umsetzen"],
    "decisions": [],
    "questions": []
  }
}
```

### Ticket
```json
{
  "clean_transcript": "Login schlägt fehl, wenn man ein Sonderzeichen im Passwort nutzt.",
  "summary": "Bug: Login fehlschlägt bei Sonderzeichen.",
  "actions": ["Bug‑Ticket erstellen"],
  "tags": ["ticket", "bug"],
  "data": {
    "title": "Login‑Fehler bei Sonderzeichen im Passwort",
    "impact": "User können sich nicht einloggen",
    "environment": "Prod, Webapp v2.3",
    "context": "User kann sich nicht einloggen, wenn Passwort Sonderzeichen enthält.",
    "steps": ["Login‑Seite öffnen", "Passwort mit Sonderzeichen eingeben", "Anmelden"],
    "expected": "Login funktioniert",
    "actual": "Login schlägt fehl",
    "severity": "high"
  }
}
```

---

## n8n Routing (Beispiel)
```txt
IF route === "calendar" → Kalender
ELSE IF route === "email" → E‑Mail
ELSE IF route === "ticket" → Ticketing
ELSE → Notizen/CRM
```
