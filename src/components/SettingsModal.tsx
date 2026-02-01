import { useEffect, useState } from "react";
import { SettingsSafe, ipcClient } from "../lib/ipcClient";

export function SettingsModal(props: {
  open: boolean;
  settings: SettingsSafe | null;
  onClose: () => void;
  onSave: (payload: {
    apiKey?: string;
    n8nWebhookUrl?: string;
    n8nSharedSecret?: string;
    sttLanguage?: string;
    sttModel?: string;
    sttTransport?: string;
  }) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyTouched, setApiKeyTouched] = useState(false);
  const [hotkey, setHotkey] = useState("");
  const [hotkeyTouched, setHotkeyTouched] = useState(false);
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState("");
  const [n8nSharedSecret, setN8nSharedSecret] = useState("");
  const [n8nSecretTouched, setN8nSecretTouched] = useState(false);
  const [sttLanguage, setSttLanguage] = useState("auto");
  const [sttModel, setSttModel] = useState("gpt-4o-transcribe");
  const [sttTransport, setSttTransport] = useState("batch");
  const [realtimeCheck, setRealtimeCheck] = useState<{ status: "idle" | "checking" | "ok" | "error"; message: string }>({
    status: "idle",
    message: ""
  });

  useEffect(() => {
    if (props.settings) {
      setApiKey("");
      setApiKeyTouched(false);
      setN8nWebhookUrl(props.settings.n8nWebhookUrl ?? "");
      setSttLanguage(props.settings.sttLanguage ?? "auto");
      setSttModel(props.settings.sttModel ?? "gpt-4o-transcribe");
      setSttTransport(props.settings.sttTransport ?? "batch");
      setHotkey(props.settings.hotkey ?? "");
      setHotkeyTouched(false);
      setN8nSharedSecret("");
      setN8nSecretTouched(false);
      setRealtimeCheck({ status: "idle", message: "" });
    }
  }, [props.settings]);

  if (!props.open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Settings</h3>
        <label>
          OpenAI API Key
          <input
            type="password"
            value={apiKey}
            placeholder={props.settings?.apiKeyPresent ? "Stored (leave blank to keep)" : "sk-..."}
            onChange={(event) => {
              setApiKeyTouched(true);
              setApiKey(event.target.value);
            }}
          />
        </label>
        <label>
          Hotkey
          <input
            type="text"
            value={hotkey}
            placeholder="CommandOrControl+Shift+Space"
            onChange={(event) => {
              setHotkeyTouched(true);
              setHotkey(event.target.value);
            }}
          />
        </label>
        <label>
          Transcription Transport
          <select
            value={sttTransport}
            onChange={(event) => {
              const value = event.target.value;
              setSttTransport(value);
              if (value === "realtime" && sttModel === "whisper-1") {
                setSttModel("gpt-4o-mini-transcribe");
              }
              setRealtimeCheck({ status: "idle", message: "" });
            }}
          >
            <option value="batch">Batch (stable)</option>
            <option value="realtime">Realtime data (live)</option>
          </select>
          {sttTransport === "realtime" ? (
            <div className="settings-row">
              <button
                className="secondary"
                disabled={realtimeCheck.status === "checking"}
                onClick={async () => {
                  if (!ipcClient.isAvailable()) {
                    setRealtimeCheck({ status: "error", message: "Electron IPC unavailable." });
                    return;
                  }
                  setRealtimeCheck({ status: "checking", message: "Checking realtime access..." });
                  try {
                    const result = await ipcClient.invoke("stt.realtimeCheck");
                    setRealtimeCheck({
                      status: result.ok ? "ok" : "error",
                      message: result.message ?? (result.ok ? "Realtime available." : "Realtime unavailable.")
                    });
                  } catch (err: any) {
                    setRealtimeCheck({ status: "error", message: err?.message ?? "Realtime check failed." });
                  }
                }}
              >
                {realtimeCheck.status === "checking" ? "Checking..." : "Realtime Check"}
              </button>
              {realtimeCheck.status !== "idle" ? (
                <span className={`settings-hint ${realtimeCheck.status}`}>{realtimeCheck.message}</span>
              ) : null}
            </div>
          ) : null}
        </label>
        <label>
          Transcription Model
          <select value={sttModel} onChange={(event) => setSttModel(event.target.value)}>
            <option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe (fast)</option>
            <option value="gpt-4o-transcribe">gpt-4o-transcribe (accurate)</option>
            <option value="whisper-1" disabled={sttTransport === "realtime"}>
              whisper-1 (legacy, batch only)
            </option>
          </select>
          {sttTransport === "realtime" ? (
            <span className="mode-hint">Realtime supports gpt-4o-mini-transcribe or gpt-4o-transcribe.</span>
          ) : null}
        </label>
        <label>
          Transcription Language
          <select value={sttLanguage} onChange={(event) => setSttLanguage(event.target.value)}>
            <option value="auto">Auto</option>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="it">Italiano</option>
            <option value="es">Español</option>
          </select>
        </label>
        <label>
          N8N Webhook URL
          <input
            type="text"
            value={n8nWebhookUrl}
            onChange={(event) => setN8nWebhookUrl(event.target.value)}
          />
        </label>
        <label>
          N8N Shared Secret
          <input
            type="password"
            value={n8nSharedSecret}
            onChange={(event) => {
              setN8nSecretTouched(true);
              setN8nSharedSecret(event.target.value);
            }}
            placeholder={props.settings?.n8nSecretPresent ? "Stored (leave blank to keep)" : ""}
          />
        </label>
        <div className="button-row">
          <button
            className="primary"
            onClick={() => {
              const payload: {
                apiKey?: string;
                n8nWebhookUrl?: string;
                n8nSharedSecret?: string;
                sttLanguage?: string;
                sttModel?: string;
                sttTransport?: string;
                hotkey?: string;
              } = {
                n8nWebhookUrl,
                sttLanguage,
                sttModel,
                sttTransport
              };
              if (apiKeyTouched) {
                payload.apiKey = apiKey;
              }
              if (hotkeyTouched && hotkey.trim()) {
                payload.hotkey = hotkey.trim();
              }
              if (n8nSecretTouched) {
                payload.n8nSharedSecret = n8nSharedSecret;
              }
              props.onSave(payload);
            }}
          >
            Save
          </button>
          <button className="secondary" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
