import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
const exec = promisify(execFile);
export async function repositoryPath(path: string) {
  if (!isAbsolute(path)) throw new Error("Use um caminho absoluto");
  const canonical = await realpath(path);
  if (!(await stat(canonical)).isDirectory())
    throw new Error("O caminho precisa ser um diretório");
  return canonical;
}
export async function git(cwd: string, args: string[]) {
  return (
    await exec(
      "git",
      ["--no-optional-locks", "-c", "core.fsmonitor=false", ...args],
      {
        cwd,
        timeout: 5000,
        maxBuffer: 512 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_PAGER: "cat" },
      },
    )
  ).stdout;
}
export async function gitInfo(cwd: string) {
  try {
    return {
      branch: (await git(cwd, ["branch", "--show-current"])).trim(),
      revision: (await git(cwd, ["rev-parse", "HEAD"])).trim(),
      status: await git(cwd, ["status", "--short"]),
      diff: await git(cwd, [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--stat",
      ]),
    };
  } catch {
    return {
      branch: null,
      revision: null,
      status: "Repositório sem commit ou Git indisponível",
      diff: "",
    };
  }
}
export async function instructions(cwd: string) {
  const result: Record<string, string> = {};
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    try {
      const path = await realpath(join(cwd, name));
      if (!inside(cwd, path) || (await stat(path)).size > 64 * 1024) continue;
      result[name] = await readFile(path, "utf8");
    } catch {
      /* Optional instruction file. */
    }
  }
  return result;
}
export function inside(root: string, path: string) {
  const rel = relative(root, path);
  return (
    rel === "" ||
    (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
  );
}
export async function manifest(cwd: string) {
  const path = await realpath(join(cwd, "target/manifest.json"));
  if (!inside(cwd, path)) throw new Error("Manifest fora do repositório");
  if ((await stat(path)).size > 25 * 1024 * 1024)
    throw new Error("Manifest excede 25 MB");
  const json = JSON.parse(await readFile(path, "utf8"));
  const nodes = { ...json.sources, ...json.nodes } as Record<
    string,
    {
      name: string;
      resource_type: string;
      original_file_path: string;
      depends_on?: { nodes: string[] };
    }
  >;
  return Object.entries(nodes).map(([id, n]) => ({
    id,
    name: n.name,
    type: n.resource_type,
    path: n.original_file_path,
    parents: n.depends_on?.nodes ?? [],
    children: (json.child_map?.[id] ?? []) as string[],
  }));
}
