# Troubleshooting / Bekannte Probleme

## Bekannte Probleme / Einschränkungen
- Hotkeys unter **Ubuntu/Wayland** oft blockiert → X11 nutzen
- Lange Aufnahmen sammeln Audio im RAM (kann groß werden)
- API‑Timeouts sind minimal (MVP)
- **SQLite (sql.js / WASM)** benötigt keine Build‑Tools (kein native Compile).

## SQLite (sql.js): keine Native‑Builds nötig
Wenn du zuvor `better-sqlite3` verwendet hast, entferne alte `node_modules` + Lockfile und installiere neu.

## Realtime Transcription not supported / Verbindung wird geschlossen
Fehler wie „Model *…* is not supported in realtime mode“ oder „Realtime transcription closed“ bedeuten
meist **keinen** Code‑Bug, sondern **fehlenden Realtime‑Access** für dein Projekt/API‑Key.

Was du tun kannst:
- Stelle in den Settings **Transcription Transport** auf **Batch (stable)** → App läuft weiter.
- Prüfe, ob dein Key zu einem Projekt mit Realtime‑Freigabe gehört.
- Wenn du den Zugang brauchst: OpenAI Support bzw. Org‑Verifizierung prüfen.

## Network/DNS Error (EAI_AGAIN)
Wenn du Fehler wie `getaddrinfo EAI_AGAIN api.openai.com` siehst, ist das ein **DNS/Netzwerk‑Problem**.
Typische Ursachen: kein Internet, DNS‑Timeouts, VPN/Proxy‑Block.
Lösung: Netzwerk prüfen, DNS wechseln, VPN deaktivieren oder erneut versuchen.

## Hotkeys unter Linux (Wayland vs. X11):  
Electron nutzt `globalShortcut` für systemweite Hotkeys. Unter **Wayland** blockieren viele Compositor‑Policies globale Shortcuts aus Sicherheitsgründen – der Hotkey funktioniert dann oft **nur bei fokussiertem Fenster** oder gar nicht. Unter **X11** klappt es in der Regel zuverlässig. Lösung: Auf Ubuntu beim Login „**Ubuntu on Xorg**“ wählen (oder Wayland deaktivieren), dann sind globale Hotkeys stabil.
