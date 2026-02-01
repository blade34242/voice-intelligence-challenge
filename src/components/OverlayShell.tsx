import { ReactNode } from "react";
import { AppState } from "../lib/ipcClient";
import { Mode } from "../lib/schemas";
import { MODES } from "../lib/modes";

const statusLabels: Record<AppState, string> = {
  idle: "Ready",
  recording: "Listening...",
  finalizing_transcript: "Finalizing transcript...",
  enriching: "Enriching...",
  done: "Done",
  error: "Error"
};

export function OverlayShell(props: {
  state: AppState;
  mode: Mode;
  timer?: string;
  transportLabel?: string;
  transportTone?: "realtime" | "batch";
  onModeChange?: (mode: Mode) => void;
  allowModeChange?: boolean;
  modeDisplay?: string;
  modeControl?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const allowModeChange = props.allowModeChange ?? true;
  return (
    <div className="overlay-shell">
      <div className="drag-bar" aria-hidden="true" />
      <header className="overlay-header">
        <div className="header-left">
          <div className="logo" aria-hidden="true">
            EV
          </div>
          <div>
            <div className="title">Everlast Voice Intelligence</div>
            <div className="status">Status: {statusLabels[props.state]}</div>
          </div>
        </div>
        <button className="icon-button" onClick={props.onClose} aria-label="Close">
          X
        </button>
      </header>

      <div className="row">
        <div className="row-label">Mode:</div>
        {props.modeControl ? (
          props.modeControl
        ) : allowModeChange ? (
          <select
            value={props.mode}
            onChange={(event) => props.onModeChange?.(event.target.value as Mode)}
            className="mode-select"
          >
            {MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="mode-display">{props.modeDisplay ?? props.mode}</div>
        )}
        {props.timer ? <div className="timer">Timer: {props.timer}</div> : null}
        {props.transportLabel ? (
          <span className={`transport-badge ${props.transportTone ?? "batch"}`}>
            {props.transportLabel}
          </span>
        ) : null}
      </div>

      <div className="content">{props.children}</div>

      {props.actions ? <div className="footer">{props.actions}</div> : null}
    </div>
  );
}
