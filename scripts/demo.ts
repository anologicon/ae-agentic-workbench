import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { Store, identity } from "../packages/knowledge/src/store.ts";
import type {
  Project,
  Resource,
  Worksession,
} from "../packages/domain/src/index.ts";
const root = resolve(process.env.WORKBENCH_HOME ?? ".workbench");
const store = new Store(join(root, "state.sqlite"));
if (store.all("project").length) {
  console.log("O workspace já tem projetos. Nenhum dado foi alterado.");
  store.close();
  process.exit(0);
}
const project: Project = {
  ...identity("prj"),
  name: "Migração Dataform → dbt",
  objective:
    "Conectar transformação, orquestração e conhecimento de pagamentos.",
  kind: "finite",
};
const prepared: { resource: Resource; session: Worksession }[] = [];
const demoRoot = await mkdtemp(join(root, "demo-repos-"));
for (const name of ["dbt", "dataform", "airflow"]) {
  const path = join(demoRoot, name);
  await mkdir(path, { recursive: true });
  await writeFile(
    join(path, "AGENTS.md"),
    `# ${name}\nInvestigue somente este repositório. Registre evidências. Não altere arquivos sem autorização.\n`,
  );
  await writeFile(
    join(
      path,
      name === "airflow"
        ? "payments_dag.py"
        : name === "dbt"
          ? "payments.sql"
          : "payments.sqlx",
    ),
    name === "airflow"
      ? "# Daily payments pipeline\nMODEL_NAME = 'payments'\n"
      : "-- payments: approved transactions\nselect 1 as payment_id\n",
  );
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: path });
  execFileSync("git", ["add", "."], { cwd: path });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Workbench Demo",
      "-c",
      "user.email=demo@localhost",
      "commit",
      "-qm",
      "Initial demo fixture",
    ],
    { cwd: path },
  );
  const resource: Resource = {
    ...identity("res"),
    name,
    path,
    kind: "repository",
  };

  const session: Worksession = {
    ...identity("ws"),
    project_id: project.id,
    resource_id: resource.id,
    cwd: path,
    provider: "shell",
    state: "stopped",
  };
  prepared.push({ resource, session });
  if (name === "dbt") {
    await mkdir(join(path, "target"), { recursive: true });
    await writeFile(
      join(path, "target/manifest.json"),
      JSON.stringify({
        nodes: {
          "model.demo.payments": {
            name: "payments",
            resource_type: "model",
            original_file_path: "payments.sql",
            depends_on: { nodes: [] },
          },
        },
      }),
    );
  }
}
store.transaction(() => {
  store.put("project", project);
  for (const { resource, session } of prepared) {
    store.put("resource", resource);
    store.link(project.id, resource.id);
    store.put("session", session);
  }
  store.event("demo.created", project.id);
});
store.close();
console.log(
  "Demo criada: três repositórios Git e três worksessions. Execute npm run dev.",
);
