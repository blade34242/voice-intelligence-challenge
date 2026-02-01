# Security Notes (Risiken & Verbesserungen)

## Risiken / offene Punkte
- **API‑Key‑Speicherung:** `electron-store` ist ok fürs MVP, aber nicht so stark wie OS‑Keychain (Keytar).
- **Webhook‑Secret:** Wird mitgesendet, aber keine Signatur/HMAC → Payloads sind fälschbar, wenn URL bekannt.
- **CSP‑Warning:** In Dev ok, in Prod sollte CSP strenger sein.
- **Logs:** Transkripte dürfen nicht in Logs landen (derzeit ok, aber nicht explizit abgesichert).

## Verbesserungen (Produktion)
- API‑Key in Keychain/Secret‑Store speichern
- Webhook‑Signatur (HMAC) hinzufügen
- CSP‑Policy im Renderer setzen
- Optional: „Privacy Mode“ (keine Speicherung, keine Historie)
