import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createRuntime } from "../apps/runtime/src/server.ts";
import { identity } from "../packages/knowledge/src/store.ts";

test("MCP stdio: descoberta, delegação assíncrona e resultado do runtime real", async () => {
  const dir = await mkdtemp(join(tmpdir(), "workbench-mcp-"));
  const token = "test-mcp-token";
  await writeFile(join(dir, "pairing-token"), token);
  await writeFile(join(dir, "dag.py"), "model = 'payments'\n");
  const runtime = createRuntime({
    dbPath: join(dir, "state.sqlite"),
    pairingToken: token,
  });
  runtime.server.listen(0, "127.0.0.1");
  await once(runtime.server, "listening");
  const address = runtime.server.address();
  assert(address && typeof address !== "string");
  const project = {
    ...identity("prj"),
    name: "MCP test",
    kind: "finite",
    objective: "test",
  };
  runtime.store.put("project", project);
  const ws = {
    ...identity("ws"),
    project_id: project.id,
    resource_id: "res_test",
    cwd: dir,
    provider: "shell",
    state: "stopped",
  };
  runtime.store.put("session", ws);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", resolve("packages/mcp-workbench/src/index.ts")],
    cwd: resolve("."),
    env: {
      PATH: process.env.PATH ?? "",
      WORKBENCH_HOME: dir,
      WORKBENCH_PORT: String(address.port),
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "integration-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 8);
    const requested = await client.callTool({
      name: "workbench.request_task",
      arguments: {
        project_id: project.id,
        target_workspace_id: ws.id,
        objective: "Find DAG",
        query: "payments",
        idempotency_key: "mcp-request",
      },
    });
    assert(!requested.isError);
    const content = requested.content as { type: string; text: string }[];
    const task = JSON.parse(content[0].text);
    assert(task.id.startsWith("tsk_"));
    let completed = false;
    for (let i = 0; i < 100; i++) {
      const result = await client.callTool({
        name: "workbench.get_task_result",
        arguments: { task_id: task.id },
      });
      const row = JSON.parse((result.content as { text: string }[])[0].text);
      if (row.state === "completed") {
        assert.equal(row.result.evidence[0].path, "dag.py");
        completed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    assert(completed);
  } finally {
    await client.close();
    await runtime.close();
    await rm(dir, { recursive: true, force: true });
  }
});
