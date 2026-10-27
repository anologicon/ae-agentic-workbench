import * as pty from "node-pty";
import type { WebSocket } from "ws";
import type { Worksession } from "../../../packages/domain/src/index.ts";
import { Store } from "../../../packages/knowledge/src/store.ts";
export class Terminals {
  private closed = false;
  private processes = new Map<
    string,
    { pty: pty.IPty; clients: Set<WebSocket>; buffer: string }
  >();
  constructor(private store: Store) {}
  start(ws: Worksession) {
    if (this.processes.has(ws.id)) return;
    const commands = {
      shell: process.platform === "win32" ? "powershell.exe" : "/bin/bash",
      codex: "codex",
      claude: "claude",
    };
    // Provider credentials are inherited by the explicitly started interactive CLI.
    // Raw terminal bytes are kept only in bounded volatile memory, never in SQLite.
    const child = pty.spawn(commands[ws.provider], [], {
      name: "xterm-256color",
      cols: 100,
      rows: 28,
      cwd: ws.cwd,
      env: process.env as Record<string, string>,
    });
    const item = { pty: child, clients: new Set<WebSocket>(), buffer: "" };
    this.processes.set(ws.id, item);
    ws.state = "running";
    this.store.put("session", ws);
    this.store.event("session.started", ws.id, { provider: ws.provider });
    child.onData((data) => {
      item.buffer = (item.buffer + data).slice(-64000);
      for (const client of item.clients)
        if (client.readyState === 1 && client.bufferedAmount < 1024 * 1024)
          client.send(JSON.stringify({ type: "data", data }));
    });
    child.onExit(({ exitCode }) => {
      this.processes.delete(ws.id);
      if (this.closed) return;
      const latest = this.store.get<Worksession>("session", ws.id)!;
      latest.state = "stopped";
      this.store.put("session", latest);
      this.store.event("session.stopped", ws.id, { exitCode });
      for (const client of item.clients) {
        client.send(JSON.stringify({ type: "exit", exitCode }));
        client.close();
      }
    });
  }
  attach(id: string, client: WebSocket) {
    const item = this.processes.get(id);
    if (!item) {
      client.close(1008, "Inicie a sessão antes de conectar");
      return;
    }
    item.clients.add(client);
    client.send(JSON.stringify({ type: "data", data: item.buffer }));
    client.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (
          message.type === "input" &&
          typeof message.data === "string" &&
          message.data.length <= 16384
        )
          item.pty.write(message.data);
        else if (
          message.type === "resize" &&
          Number.isInteger(message.cols) &&
          Number.isInteger(message.rows)
        )
          item.pty.resize(
            Math.max(2, Math.min(300, message.cols)),
            Math.max(2, Math.min(100, message.rows)),
          );
      } catch {
        client.close(1008, "Mensagem inválida");
      }
    });
    client.on("close", () => item.clients.delete(client));
  }
  stop(id: string) {
    this.processes.get(id)?.pty.kill();
  }
  close() {
    this.closed = true;
    for (const [id, item] of this.processes) {
      const session = this.store.get<Worksession>("session", id)!;
      session.state = "interrupted";
      this.store.put("session", session);
      this.store.event("session.interrupted", id);
      item.pty.kill();
    }
  }
}
