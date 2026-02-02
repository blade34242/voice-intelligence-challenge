import { AppState } from "../lib/ipcClient";

export function RecorderPanel(props: {
  state: AppState;
  transcript: string;
  placeholder: string;
  onStart: () => void;
  onStop: () => void;
  onSettings: () => void;
  error?: string | null;
  notice?: string | null;
  hotkey?: string;
  modeLabel?: string;
  languageLabel?: string;
  followUpLabel?: string | null;
  followUpSummary?: string | null;
}) {
  const isRecording = props.state === "recording";
  const canStart = props.state === "idle" || props.state === "error" || props.state === "done";
  const showStop = props.state === "recording";
  const showQuickStart = props.state === "idle" || props.state === "error";
  const defaultHotkey =
    typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("win")
      ? "Ctrl+Shift+R"
      : "Ctrl+Shift+Space";
  const hotkeyLabel = props.hotkey?.trim() || defaultHotkey;
  const modeLabel = props.modeLabel ?? "Auto (LLM decides)";
  const languageLabel = props.languageLabel ?? "Auto";

  return (
    <div className="recorder-panel">
      {props.followUpLabel ? (
        <div className="followup-banner">
          <div className="followup-title">{props.followUpLabel}</div>
          {props.followUpSummary ? <div className="followup-summary">{props.followUpSummary}</div> : null}
        </div>
      ) : null}
      <div className="transcript-box">
        {props.transcript ? (
          <p>{props.transcript}</p>
        ) : (
          <p className="placeholder">{props.placeholder}</p>
        )}
      </div>

      {showQuickStart ? (
        <div className="quick-start">
          <div className="quick-title">Quick start</div>
          <div className="quick-steps">
            <div className="quick-step">
              <span className="quick-dot">1</span>
              <span>Hotkey to open: {hotkeyLabel}</span>
            </div>
            <div className="quick-step">
              <span className="quick-dot">2</span>
              <span>Press Start and speak</span>
            </div>
            <div className="quick-step">
              <span className="quick-dot">3</span>
              <span>Stop to generate structured output</span>
            </div>
            <div className="quick-step">
              <span className="quick-dot">4</span>
              <span>Copy or export the result</span>
            </div>
          </div>
          <div className="quick-meta">
            <span className="quick-pill">Mode: {modeLabel}</span>
            <span className="quick-pill">Language: {languageLabel}</span>
          </div>
        </div>
      ) : null}

      {props.notice ? <div className="notice">{props.notice}</div> : null}
      {props.error ? <div className="error">{props.error}</div> : null}

      <div className="button-row">
        {showStop ? (
          <button className="primary" onClick={props.onStop}>
            Stop Recording
          </button>
        ) : (
          <button className="primary" onClick={props.onStart} disabled={!canStart}>
            Start Recording
          </button>
        )}
        {!isRecording ? (
          <button className="secondary" onClick={props.onSettings}>
            Settings
          </button>
        ) : null}
      </div>
    </div>
  );
}
