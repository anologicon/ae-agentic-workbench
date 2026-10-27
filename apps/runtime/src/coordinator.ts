import type { Task, Worksession } from "../../../packages/domain/src/index.ts";
import { Store, identity } from "../../../packages/knowledge/src/store.ts";
import { investigate } from "../../../packages/agent-adapters/src/local-search.ts";
export class Coordinator {
  private active = new Map<string, AbortController>();
  private closed = false;
  constructor(
    private store: Store,
    private worker: typeof investigate = investigate,
  ) {}
  request(
    input: Omit<Task, "id" | "created_at" | "state" | "result" | "error">,
  ) {
    const existing = this.store.db
      .prepare("SELECT task_id FROM idempotency WHERE key=?")
      .get(input.idempotency_key) as { task_id: string } | undefined;
    if (existing) {
      const task = this.store.get<Task>("task", existing.task_id)!;
      const comparable = Object.keys(input).every(
        (key) =>
          JSON.stringify(task[key as keyof Task]) ===
          JSON.stringify(input[key as keyof typeof input]),
      );
      if (!comparable)
        throw new Error("Chave de idempotência reutilizada com outro conteúdo");
      return task;
    }
    const ws = this.store.get<Worksession>(
      "session",
      input.target_workspace_id,
    );
    if (!ws || ws.project_id !== input.project_id)
      throw new Error("Sessão destino não pertence ao projeto");
    if (input.parent_task_id) {
      const parent = this.store.get<Task>("task", input.parent_task_id);
      if (
        !parent ||
        parent.project_id !== input.project_id ||
        parent.parent_task_id
      )
        throw new Error(
          "Delegação limitada a profundidade 1 dentro do projeto",
        );
    }
    const task: Task = {
      ...input,
      ...identity("tsk"),
      state: "queued",
      result: null,
      error: null,
    };
    this.store.transaction(() => {
      this.store.put("task", task);
      this.store.db
        .prepare("INSERT INTO idempotency VALUES(?,?)")
        .run(input.idempotency_key, task.id);
      this.store.event("task.queued", task.id, { project_id: task.project_id });
    });
    queueMicrotask(() => this.pump());
    return task;
  }
  cancel(id: string) {
    const task = this.store.get<Task>("task", id);
    if (!task) throw new Error("Tarefa inexistente");
    if (!["queued", "running"].includes(task.state)) return task;
    this.active.get(id)?.abort();
    task.state = "cancelled";
    this.save(task);
    return task;
  }
  private save(task: Task) {
    this.store.transaction(() => {
      this.store.put("task", task);
      this.store.event(`task.${task.state}`, task.id);
    });
  }
  private pump() {
    if (this.closed) return;
    for (const task of this.store
      .all<Task>("task")
      .filter((t) => t.state === "queued")) {
      if (this.active.size >= 2) break;
      const workspaceBusy = this.store
        .all<Task>("task")
        .some(
          (t) =>
            t.state === "running" &&
            t.target_workspace_id === task.target_workspace_id,
        );
      if (!workspaceBusy) void this.run(task);
    }
  }
  private async run(task: Task) {
    const controller = new AbortController();
    this.active.set(task.id, controller);
    task.state = "running";
    this.save(task);
    const timer = setTimeout(() => {
      const latest = this.store.get<Task>("task", task.id)!;
      if (latest.state === "running") {
        latest.state = "timed_out";
        this.save(latest);
        controller.abort();
      }
    }, task.timeout_seconds * 1000);
    try {
      const ws = this.store.get<Worksession>(
        "session",
        task.target_workspace_id,
      )!;
      const result = await this.worker(ws.cwd, task.query, controller.signal);
      if (!controller.signal.aborted) {
        task.result = result;
        task.state = "completed";
        this.save(task);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        task.state = "failed";
        task.error =
          error instanceof Error ? error.message : "Falha na investigação";
        this.save(task);
      }
    } finally {
      clearTimeout(timer);
      this.active.delete(task.id);
      this.pump();
    }
  }
  async close() {
    this.closed = true;
    for (const [id, controller] of this.active) {
      controller.abort();
      const task = this.store.get<Task>("task", id)!;
      task.state = "interrupted";
      this.save(task);
    }
    while (this.active.size)
      await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
