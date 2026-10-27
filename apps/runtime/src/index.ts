import { mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import { createRuntime } from "./server.ts";
const dir = resolve(process.env.WORKBENCH_HOME ?? ".workbench");
mkdirSync(dir, { recursive: true, mode: 0o700 });
const tokenFile = join(dir, "pairing-token");
let token: string;
try {
  token = readFileSync(tokenFile, "utf8").trim();
} catch {
  token = randomBytes(24).toString("hex");
  writeFileSync(tokenFile, token, { mode: 0o600 });
}
chmodSync(tokenFile, 0o600);
const port = Number(process.env.WORKBENCH_PORT ?? 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("WORKBENCH_PORT inválida");
const runtime = createRuntime({
  dbPath: join(dir, "state.sqlite"),
  pairingToken: token,
  port,
});
runtime.server.listen(port, "127.0.0.1", () => {
  console.log(
    `Workbench: http://127.0.0.1:${port}\nDesenvolvimento: http://127.0.0.1:5173\nCódigo de pareamento local: ${token}`,
  );
});
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    void runtime.close().then(() => process.exit(0));
  });
