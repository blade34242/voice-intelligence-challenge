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
}) {
  const isRecording = props.state === "recording";
  const canStart = props.state === "idle" || props.state === "error" || props.state === "done";
  const showStop = props.state === "recording";
  const showReset = props.state === "error";

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
