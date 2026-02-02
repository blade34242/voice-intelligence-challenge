import fs from "fs";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";
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
  coverage: number | null;
};

let sqlPromise: Promise<SqlJsStatic> | null = null;
let db: Database | null = null;
let dbPath: string | null = null;

function getDbPath() {
  if (!dbPath) {
    dbPath = path.join(app.getPath("userData"), "everlast.sqlite");
  }
  return dbPath;
}

function resolveWasmPath() {
  const appPath = app.getAppPath();
  const resourcesPath = process.resourcesPath;
  const candidates = [
    path.join(appPath, "node_modules/sql.js/dist/sql-wasm.wasm"),
    resourcesPath ? path.join(resourcesPath, "app.asar.unpacked/node_modules/sql.js/dist/sql-wasm.wasm") : null,
    resourcesPath ? path.join(resourcesPath, "node_modules/sql.js/dist/sql-wasm.wasm") : null,
    path.join(appPath, "..", "node_modules/sql.js/dist/sql-wasm.wasm")
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("sql.js wasm not found. Reinstall dependencies or adjust packaging.");
}

async function loadSqlJs() {
  if (!sqlPromise) {
    const wasmPath = resolveWasmPath();
    const wasmBinary = fs.readFileSync(wasmPath);
    sqlPromise = initSqlJs({ wasmBinary });
  }
  return sqlPromise;
}

async function ensureDb() {
  if (db) return db;
  const SQL = await loadSqlJs();
  const filePath = getDbPath();
  let fileData: Uint8Array | undefined;
  if (fs.existsSync(filePath)) {
    fileData = new Uint8Array(fs.readFileSync(filePath));
  }
  db = new SQL.Database(fileData);
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
      parent_id INTEGER,
      coverage REAL
    );
  `);
  ensureCoverageColumn(db);
  return db;
}

function ensureCoverageColumn(database: Database) {
  const info = database.exec("PRAGMA table_info(runs)");
  const rows = info?.[0]?.values ?? [];
  const hasCoverage = rows.some((row) => row?.[1] === "coverage");
  if (!hasCoverage) {
    database.exec("ALTER TABLE runs ADD COLUMN coverage REAL");
  }
}

async function persistDb(database: Database) {
  const data = database.export();
  fs.writeFileSync(getDbPath(), Buffer.from(data));
}

function queryRows(
  database: Database,
  sql: string,
  params: Array<string | number | null | Uint8Array> = []
) {
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export async function initHistoryDb() {
  const database = await ensureDb();
  if (!fs.existsSync(getDbPath())) {
    await persistDb(database);
  }
}

export async function saveRun(params: {
  name: string;
  createdAt: string;
  mode: string;
  transcript: string;
  result: unknown;
  changeLog?: unknown[];
  isFollowUp?: boolean;
  parentId?: number | null;
  coverage?: number | null;
}) {
  const database = await ensureDb();
  const stmt = database.prepare(
    `INSERT INTO runs (name, created_at, mode, transcript, result_json, change_log_json, is_followup, parent_id, coverage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run([
    params.name,
    params.createdAt,
    params.mode,
    params.transcript,
    JSON.stringify(params.result),
    JSON.stringify(params.changeLog ?? []),
    params.isFollowUp ? 1 : 0,
    params.parentId ?? null,
    params.coverage ?? null
  ]);
  stmt.free();
  const rows = database.exec("SELECT last_insert_rowid() AS id");
  const nextId = Number(rows?.[0]?.values?.[0]?.[0] ?? 0);
  await persistDb(database);
  return nextId;
}

export async function listRuns(limit = 50) {
  const database = await ensureDb();
  return queryRows(
    database,
    `SELECT id, name, created_at, mode, is_followup, parent_id, coverage
     FROM runs
     ORDER BY id DESC
     LIMIT ?`,
    [limit]
  );
}

export async function listRunsWithResults(limit = 50) {
  const database = await ensureDb();
  const rows = queryRows(
    database,
    `SELECT id, name, created_at, mode, is_followup, parent_id, coverage, result_json
     FROM runs
     ORDER BY id DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((row) => ({
    ...row,
    result: row["result_json"] ? JSON.parse(String(row["result_json"])) : null
  }));
}

export async function getRun(id: number) {
  const database = await ensureDb();
  const rows = queryRows(database, `SELECT * FROM runs WHERE id = ?`, [id]);
  const row = rows[0] as RunRow | undefined;
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
    parent_id: row.parent_id,
    coverage: row.coverage ?? null
  };
}

export async function setRunCoverage(id: number, coverage: number) {
  const database = await ensureDb();
  const stmt = database.prepare(`UPDATE runs SET coverage = ? WHERE id = ?`);
  stmt.run([coverage, id]);
  stmt.free();
  await persistDb(database);
}

export async function renameRun(id: number, name: string) {
  const database = await ensureDb();
  const stmt = database.prepare(`UPDATE runs SET name = ? WHERE id = ?`);
  stmt.run([name, id]);
  stmt.free();
  const changes = database.getRowsModified();
  await persistDb(database);
  return changes > 0;
}
