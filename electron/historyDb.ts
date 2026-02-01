import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

type RunRow = {
  id: number;
  name: string;
  created_at: string;
  mode: string;
  transcript: string;
  result_json: string;
  change_log_json: string | null;
  is_followup: number;
  parent_id: number | null;
};

let db: Database | null = null;

function ensureDb() {
  if (db) return db;
  const dbPath = path.join(app.getPath("userData"), "everlast.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      mode TEXT NOT NULL,
      transcript TEXT NOT NULL,
      result_json TEXT NOT NULL,
      change_log_json TEXT,
      is_followup INTEGER NOT NULL DEFAULT 0,
      parent_id INTEGER
    );
  `);
  return db;
}

export function initHistoryDb() {
  ensureDb();
}

export function saveRun(params: {
  name: string;
  createdAt: string;
  mode: string;
  transcript: string;
  result: unknown;
  changeLog?: unknown[];
  isFollowUp?: boolean;
  parentId?: number | null;
}) {
  const database = ensureDb();
  const stmt = database.prepare(
    `INSERT INTO runs (name, created_at, mode, transcript, result_json, change_log_json, is_followup, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const info = stmt.run(
    params.name,
    params.createdAt,
    params.mode,
    params.transcript,
    JSON.stringify(params.result),
    JSON.stringify(params.changeLog ?? []),
    params.isFollowUp ? 1 : 0,
    params.parentId ?? null
  );
  return Number(info.lastInsertRowid);
}

export function listRuns(limit = 50) {
  const database = ensureDb();
  const stmt = database.prepare(
    `SELECT id, name, created_at, mode, is_followup, parent_id
     FROM runs
     ORDER BY id DESC
     LIMIT ?`
  );
  return stmt.all(limit);
}

export function getRun(id: number) {
  const database = ensureDb();
  const stmt = database.prepare(`SELECT * FROM runs WHERE id = ?`);
  const row = stmt.get(id) as RunRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    mode: row.mode,
    transcript: row.transcript,
    result: JSON.parse(row.result_json),
    changeLog: row.change_log_json ? JSON.parse(row.change_log_json) : [],
    is_followup: row.is_followup,
    parent_id: row.parent_id
  };
}

export function renameRun(id: number, name: string) {
  const database = ensureDb();
  const stmt = database.prepare(`UPDATE runs SET name = ? WHERE id = ?`);
  const info = stmt.run(name, id);
  return info.changes > 0;
}
