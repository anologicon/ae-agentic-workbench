import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { inside, gitInfo } from "../../integrations/src/index.ts";
import type { InvestigationResult } from "../../domain/src/index.ts";
const ignored = new Set([
  ".git",
  "node_modules",
  ".env",
  ".aws",
  ".ssh",
  ".workbench",
  "dist",
  "venv",
  ".venv",
  "__pycache__",
]);
const extensions = new Set([
  ".py",
  ".sql",
  ".sqlx",
  ".md",
  ".yml",
  ".yaml",
  ".json",
  ".ts",
  ".js",
  ".toml",
]);
/** Deterministic read-only adapter: no shell, no LLM, no execution of source content. */
export async function investigate(
  cwd: string,
  query: string,
  signal: AbortSignal,
): Promise<InvestigationResult> {
  const result: InvestigationResult = {
    summary: "",
    evidence: [],
    files_read: [],
    limitations: [
      "Busca literal local, sem interpretação por LLM.",
      "Máximo: 2.000 entradas, 200 arquivos, 256 KB por arquivo e 50 evidências. Arquivos ocultos, symlinks e diretórios de dependências são ignorados.",
    ],
    actions: ["Leitura de arquivos e metadados Git"],
    usage: { provider: "local-search", llm_calls: 0, cost_usd: 0 },
  };
  const info = await gitInfo(cwd);
  let entries = 0;
  const needle = query.toLocaleLowerCase();
  async function visit(dir: string, depth: number): Promise<void> {
    signal.throwIfAborted();
    if (
      depth > 12 ||
      entries >= 2000 ||
      result.files_read.length >= 200 ||
      result.evidence.length >= 50
    )
      return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      signal.throwIfAborted();
      if (
        ++entries > 2000 ||
        result.files_read.length >= 200 ||
        result.evidence.length >= 50
      )
        break;
      if (
        entry.name.startsWith(".") ||
        ignored.has(entry.name) ||
        entry.isSymbolicLink()
      )
        continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(path, depth + 1);
        continue;
      }
      if (!entry.isFile() || !extensions.has(extname(entry.name))) continue;
      const resolved = await realpath(path);
      if (!inside(cwd, resolved) || (await stat(resolved)).size > 256 * 1024)
        continue;
      const content = await readFile(resolved, "utf8");
      if (content.includes("\0")) continue;
      const name = relative(cwd, resolved);
      result.files_read.push(name);
      for (const [index, line] of content.split("\n").entries())
        if (
          line.toLocaleLowerCase().includes(needle) &&
          result.evidence.length < 50
        )
          result.evidence.push({
            uri: pathToFileURL(resolved).href,
            path: name,
            line: index + 1,
            excerpt: line.slice(0, 500),
            revision: info.revision,
          });
    }
  }
  await visit(cwd, 0);
  signal.throwIfAborted();
  result.summary = `${result.evidence.length} ocorrência(s) de “${query}” em ${result.files_read.length} arquivo(s) lido(s).`;
  return result;
}
