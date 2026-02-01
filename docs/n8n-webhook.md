# n8n Webhook (KISS)

Wenn ein Webhook gesetzt ist, wird nach jedem Run automatisch gepostet.

**Header**
- `Content-Type: application/json`
- `X-Everlast-Secret` (optional)

**Payload (Beispiel)**
```json
{
  "source": "everlast",
  "created_at": "2026-01-31T12:00:00.000Z",
  "mode": "event",
  "kind": "calendar",
  "route": "calendar",
  "transcript": "…",
  "result": {
    "clean_transcript": "…",
    "summary": "…",
    "actions": ["…"],
    "tags": ["event"],
    "data": {
      "title": "…",
      "date": null,
      "time": null,
      "timezone": null,
      "location": null,
      "attendees": [],
      "duration_minutes": null,
      "description": "…",
      "reminders": []
    }
  }
}
```

---

## Beispiele pro Mode

### Event (route: calendar)
```json
{
  "source": "everlast",
  "created_at": "2026-01-31T12:00:00.000Z",
  "mode": "event",
  "kind": "calendar",
  "route": "calendar",
  "transcript": "Sommerfest am Freitag um 18 Uhr im Stadtpark.",
  "result": {
    "clean_transcript": "Sommerfest am Freitag um 18 Uhr im Stadtpark.",
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
}
```

### Email (route: email)
```json
{
  "source": "everlast",
  "created_at": "2026-01-31T12:00:00.000Z",
  "mode": "email",
  "kind": "email",
  "route": "email",
  "transcript": "Schreib Tom, dass wir den Termin verschieben.",
  "result": {
    "clean_transcript": "Schreib Tom, dass wir den Termin verschieben.",
    "summary": "E‑Mail an Tom: Terminverschiebung.",
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
}
```

### Note (route: notes)
```json
{
  "source": "everlast",
  "created_at": "2026-01-31T12:00:00.000Z",
  "mode": "note",
  "kind": "notes",
  "route": "notes",
  "transcript": "Meeting war gut, nächste Schritte sind A und B.",
  "result": {
    "clean_transcript": "Meeting war gut, nächste Schritte sind A und B.",
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
}
```

### Ticket (route: ticket)
```json
{
  "source": "everlast",
  "created_at": "2026-01-31T12:00:00.000Z",
  "mode": "ticket",
  "kind": "ticket",
  "route": "ticket",
  "transcript": "Login schlägt fehl, wenn Passwort Sonderzeichen enthält.",
  "result": {
    "clean_transcript": "Login schlägt fehl, wenn Passwort Sonderzeichen enthält.",
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
}
```

**Routing‑Idee in n8n**
```txt
IF route === "calendar" → Kalender
ELSE IF route === "email" → E‑Mail
ELSE IF route === "ticket" → Ticketing
ELSE → Notizen/CRM
```

Für vollständige Schema‑Details und Beispiele siehe:
`docs/webhook-payloads.md`
