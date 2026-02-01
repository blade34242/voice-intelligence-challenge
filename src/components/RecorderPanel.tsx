import { AppState } from "../lib/ipcClient";

export function RecorderPanel(props: {
  state: AppState;
  transcript: string;
  placeholder: string;
  onStart: () => void;
  onStop: () => void;
  onSettings: () => void;
  onReset: () => void;
  transportLabel?: string;
  transportTone?: "realtime" | "batch";
  error?: string | null;
  notice?: string | null;
  hotkey?: string;
}) {
  const isRecording = props.state === "recording";
  const canStart = props.state === "idle" || props.state === "error" || props.state === "done";
  const showStop = props.state === "recording";
  const showReset = props.state === "error";
  const showQuickStart = props.state === "idle" || props.state === "error";
  const hotkeyLabel = props.hotkey?.trim() || "Ctrl+Shift+Space";

  return (
    <div className="recorder-panel">
      {props.transportLabel ? (
        <div className="recorder-meta">
          <span className={`transport-pill ${props.transportTone ?? "batch"}`}>
            Transcription: {props.transportLabel}
          </span>
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
        {showReset ? (
          <button className="secondary" onClick={props.onReset}>
            Reset
          </button>
        ) : null}
        {!isRecording ? (
          <button className="secondary" onClick={props.onSettings}>
            Settings
          </button>
        ) : null}
      </div>
    </div>
  );
}
