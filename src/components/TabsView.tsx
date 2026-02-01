import { useState } from "react";
import { ChangeLogEntry, RunOutput } from "../lib/schemas";

type Props = {
  result: RunOutput;
  fallbackTranscript: string;
  editableTranscript: string;
  onTranscriptChange: (value: string) => void;
  onRerunEdits: () => void;
  hasEdits: boolean;
  changeLog: ChangeLogEntry[];
};

type Tab = "transcript" | "summary" | "details" | "actions";

export function TabsView({
  result,
  fallbackTranscript,
  editableTranscript,
  onTranscriptChange,
  onRerunEdits,
  hasEdits,
  changeLog
}: Props) {
  const [tab, setTab] = useState<Tab>("summary");
  const transcript = result.clean_transcript || fallbackTranscript;

  return (
    <div className="tabs">
      <div className="tab-row">
        <button className={tab === "transcript" ? "tab active" : "tab"} onClick={() => setTab("transcript")}
        >
          Transcript
        </button>
        <button className={tab === "summary" ? "tab active" : "tab"} onClick={() => setTab("summary")}
        >
          Summary
        </button>
        <button className={tab === "details" ? "tab active" : "tab"} onClick={() => setTab("details")}
        >
          Details
        </button>
        <button className={tab === "actions" ? "tab active" : "tab"} onClick={() => setTab("actions")}
        >
          Actions
        </button>
      </div>

      <div className="tab-panel">
        {tab === "transcript" ? (
          <div>
            <p className="muted">Edit the transcript below and re-run if needed.</p>
            <textarea
              className="inline-editor"
              value={editableTranscript || transcript}
              onChange={(event) => onTranscriptChange(event.target.value)}
            />
            <div className="inline-actions">
              <button className="secondary" onClick={onRerunEdits} disabled={!hasEdits}>
                Re-run with edits
              </button>
            </div>
          </div>
        ) : null}

        {tab === "summary" ? (
          <div>
            <p>{result.summary}</p>
            {changeLog?.length ? (
              <div className="change-log">
                <h4>Updated fields</h4>
                <ul>
                  {changeLog.map((entry, index) => (
                    <li key={`${entry.path}-${index}`}>
                      <strong>{entry.path}:</strong> {entry.before ?? "null"} → {entry.after ?? "null"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "actions" ? (
          <div className="actions-grid">
            <section>
              <h4>Action Items</h4>
              <ul>
                {result.actions.map((item, index) => (
                  <li key={index}>
                    <label className="checkbox">
                      <input type="checkbox" />
                      <span>{item}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {tab === "details" ? (
          <div className="details-grid">
            <section>
              <h4>Data</h4>
              {Object.keys(result.data ?? {}).length === 0 ? (
                <p className="muted">No structured data.</p>
              ) : (
                <div className="data-grid">
                  {Object.entries(result.data ?? {}).map(([key, value]) => (
                    <div key={key} className="data-row">
                      <strong>{key}:</strong>{" "}
                      <span>{formatValue(value)}</span>
                    </div>
                  ))}
                </div>
              )}
              <pre className="pre">{JSON.stringify(result.data ?? {}, null, 2)}</pre>
            </section>
          </div>
        ) : null}

      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
