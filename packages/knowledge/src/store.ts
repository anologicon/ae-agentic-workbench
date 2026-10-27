import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL,id TEXT PRIMARY KEY,data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS project_resources (project_id TEXT NOT NULL,resource_id TEXT NOT NULL,PRIMARY KEY(project_id,resource_id));
   CREATE TABLE IF NOT EXISTS events (sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL,kind TEXT NOT NULL,subject_id TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS idempotency (key TEXT PRIMARY KEY,task_id TEXT NOT NULL);
   PRAGMA user_version=1;`);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  all<T>(kind: string): T[] {
    return (
      this.db
        .prepare("SELECT data FROM records WHERE kind=? ORDER BY rowid")
        .all(kind) as { data: string }[]
    ).map((r) => JSON.parse(r.data));
  }
  get<T>(kind: string, id: string): T | undefined {
    const row = this.db
      .prepare("SELECT data FROM records WHERE kind=? AND id=?")
      .get(kind, id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : undefined;
  }
  put<T extends { id: string }>(kind: string, value: T) {
    this.db
      .prepare(
        "INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE kind=excluded.kind",
      )
      .run(kind, value.id, JSON.stringify(value));
    return value;
  }
  event(kind: string, subject: string, data: unknown = {}) {
    this.db
      .prepare(
        "INSERT INTO events(id,kind,subject_id,data,created_at) VALUES(?,?,?,?,?)",
      )
      .run(
        randomUUID(),
        kind,
        subject,
        JSON.stringify(data),
        new Date().toISOString(),
      );
  }
  events() {
    return this.db
      .prepare("SELECT * FROM events ORDER BY sequence DESC LIMIT 100")
      .all();
  }
  link(project: string, resource: string) {
    this.db
      .prepare("INSERT OR IGNORE INTO project_resources VALUES(?,?)")
      .run(project, resource);
  }
  resourceIds(project: string) {
    return (
      this.db
        .prepare("SELECT resource_id FROM project_resources WHERE project_id=?")
        .all(project) as { resource_id: string }[]
    ).map((r) => r.resource_id);
  }
  recover() {
    this.transaction(() => {
      for (const kind of ["session", "task"])
        for (const row of this.all<{ id: string; state: string }>(kind))
          if (["running", "queued"].includes(row.state)) {
            row.state = "interrupted";
            this.put(kind, row);
            this.event(`${kind}.interrupted`, row.id);
          }
    });
  }
  close() {
    this.db.close();
  }
}
export const identity = (prefix: string) => ({
  id: `${prefix}_${randomUUID()}`,
  created_at: new Date().toISOString(),
});
