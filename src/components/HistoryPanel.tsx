import { useState } from "react";
import { HistoryItem } from "../lib/ipcClient";

export function HistoryPanel(props: {
  history: HistoryItem[];
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onLoad: (id: number) => void;
  onRename: (id: number, name: string) => void;
  showCurrent?: boolean;
  currentRunId?: number | null;
  currentRunName?: string;
  currentRunNameDirty?: boolean;
  onCurrentRunNameChange?: (value: string) => void;
  onCurrentRunNameSave?: () => void;
}) {
  const {
    history,
    query,
    onQueryChange,
    onRefresh,
    onLoad,
    onRename,
    showCurrent,
    currentRunId,
    currentRunName,
    currentRunNameDirty,
    onCurrentRunNameChange,
    onCurrentRunNameSave
  } = props;
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const startEditing = (id: number, name: string) => {
    setEditingId(id);
    setEditingValue(name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const saveEditing = (id: number) => {
    const trimmed = editingValue.trim();
    if (!trimmed) return;
    onRename(id, trimmed);
    cancelEditing();
  };

  const coverageTone = (value?: number | null) => {
    if (value === null || value === undefined) return "unknown";
    if (value < 50) return "low";
    if (value < 80) return "mid";
    return "high";
  };

  return (
    <div className="history-panel">
      {showCurrent ? (
        <section className="history-current">
          <h4>Current run</h4>
          <div className="history-current-row">
            <input
              type="text"
              value={currentRunName ?? ""}
              onChange={(event) => onCurrentRunNameChange?.(event.target.value)}
              placeholder="Untitled Run"
            />
            <button
              className="secondary"
              onClick={() => onCurrentRunNameSave?.()}
              disabled={!currentRunId || !currentRunNameDirty}
            >
              Save name
            </button>
          </div>
          {currentRunId ? <p className="muted">Run ID #{currentRunId}</p> : null}
        </section>
      ) : null}

      <section className="history-list">
        <div className="history-header">
          <div className="history-title">
            <h4>History</h4>
            <span className="muted">{history.length} items</span>
          </div>
          <button className="secondary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
        <input
          className="history-search"
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by name, mode, or id…"
        />
        <div className="history-scroll">
          {history.length === 0 ? (
            <p className="muted">No history yet.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="history-row compact">
                <div className="history-meta">
                  {editingId === item.id ? (
                    <input
                      className="history-rename"
                      type="text"
                      value={editingValue}
                      onChange={(event) => setEditingValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          saveEditing(item.id);
                        }
                        if (event.key === "Escape") {
                          cancelEditing();
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <div className="history-name">
                      {typeof item.coverage === "number" ? (
                        <span className={`coverage-badge ${coverageTone(item.coverage)}`}>
                          {item.coverage}%
                        </span>
                      ) : (
                        <span className="coverage-badge unknown">—</span>
                      )}
                      <span>{item.name}</span>
                    </div>
                  )}
                  <div className="history-sub">
                    <span>#{item.id}</span>
                    <span>• {item.mode}</span>
                    <span>• {new Date(item.created_at).toLocaleString()}</span>
                    {item.is_followup ? <span>• update #{item.parent_id}</span> : null}
                  </div>
                </div>
                <div className="history-actions">
                  {editingId === item.id ? (
                    <>
                      <button
                        className="secondary btn-sm"
                        onClick={() => saveEditing(item.id)}
                        title="Save"
                        disabled={!editingValue.trim()}
                      >
                        ✓
                      </button>
                      <button className="secondary btn-sm" onClick={cancelEditing} title="Cancel">
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="secondary btn-sm" onClick={() => onLoad(item.id)} title="Load">
                        ▶
                      </button>
                      <button
                        className="secondary btn-sm"
                        onClick={() => startEditing(item.id, item.name)}
                        title="Rename"
                      >
                        ✎
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
