import React, {
  useState,
  useEffect,
  useCallback,
  lazy,
  Suspense,
  type FormEvent,
} from "react";
import { createRoot } from "react-dom/client";
import type {
  Project,
  Resource,
  Worksession,
  Task,
  Knowledge,
  InvestigationResult,
} from "../../../packages/domain/src/index.ts";
import { Badge, Empty } from "../../../packages/ui/src/index.tsx";
import { api } from "./api.ts";
const Terminal = lazy(() =>
  import("./Terminal.tsx").then((module) => ({ default: module.Terminal })),
);
import "./style.css";
type State = {
  projects: Project[];
  resources: Resource[];
  sessions: Worksession[];
  tasks: Task[];
  knowledge: Knowledge[];
  events: {
    sequence: number;
    kind: string;
    subject_id: string;
    created_at: string;
  }[];
};
type Context = { resources: Resource[] };
function App() {
  const [state, setState] = useState<State>();
  const [paired, setPaired] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState("projects");
  const [projectId, setProjectId] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [modal, setModal] = useState("");
  const [busy, setBusy] = useState(false);
  const [dbt, setDbt] = useState<
    | {
        id: string;
        name: string;
        type: string;
        path: string;
        parents: string[];
        children: string[];
      }[]
    | null
  >(null);
  const refresh = useCallback(async () => {
    try {
      setState(await api<State>("/state"));
      setPaired(true);
    } catch (e) {
      if (e instanceof Error && e.message === "Faça o pareamento local")
        setPaired(false);
      else setError(String(e));
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => clearInterval(timer);
  }, [refresh]);
  const project =
    state?.projects.find((p) => p.id === projectId) ?? state?.projects[0];
  useEffect(() => {
    if (project)
      void api<Context>(`/projects/${project.id}/context`)
        .then((c) => setResources(c.resources))
        .catch((e) => setError(e.message));
    else setResources([]);
  }, [project, state?.resources.length]);
  const sessions =
    state?.sessions.filter((s) => s.project_id === project?.id) ?? [];
  const session = sessions.find((s) => s.id === sessionId) ?? sessions[0];
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit(
    event: FormEvent<HTMLFormElement>,
    fn: (data: FormData) => Promise<unknown>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await action(async () => {
      await fn(data);
      setModal("");
      form.reset();
    });
  }
  if (!paired)
    return (
      <main className="pair">
        <div className="mark">
          aw<span>_</span>
        </div>
        <div className="eyebrow">SEU CONTEXTO. SEU AMBIENTE.</div>
        <h1>
          Um lugar para
          <br />
          conectar o trabalho.
        </h1>
        <p>
          Organize projetos, abra terminais e investigue seus repositórios com
          contexto compartilhado.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await api("/pair", { token });
              setToken("");
            });
          }}
        >
          <label>
            Código de pareamento local
            <input
              autoFocus
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Copie o código exibido no terminal do runtime"
              required
            />
          </label>
          <button disabled={busy}>Conectar ao Workbench →</button>
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <small>
          Runtime em localhost · Código salvo em .workbench/pairing-token
        </small>
      </main>
    );
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="#" onClick={() => setView("projects")}>
          <span className="mark">
            aw<span>_</span>
          </span>
          <span>
            agentic
            <br />
            <strong>workbench</strong>
          </span>
        </a>
        <div className="eyebrow nav-label">WORKSPACE LOCAL</div>
        <nav>
          {[
            ["projects", "◫", "Projetos"],
            ["knowledge", "◇", "Knowledge"],
            ["sessions", "⌘", "Workspaces"],
            ["activity", "↗", "Atividade"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              aria-label={label}
              className={view === key ? "selected" : ""}
              onClick={() => setView(key)}
            >
              <span className="nav-icon" aria-hidden="true">
                {icon}
              </span>
              <span className="nav-text">{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-projects">
          <div className="eyebrow">
            SEUS PROJETOS{" "}
            <button
              aria-label="Criar projeto"
              onClick={() => setModal("project")}
            >
              +
            </button>
          </div>
          {state?.projects.map((p) => (
            <button
              key={p.id}
              className={project?.id === p.id ? "current" : ""}
              onClick={() => {
                setProjectId(p.id);
                setSessionId("");
                setView("projects");
                setDbt(null);
              }}
            >
              <span className="dot" />
              {p.name}
            </button>
          ))}
        </div>
        <div className="local-status">
          <span className="dot" />
          Runtime conectado<small>Local-first · v0.1 preview</small>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div>
            <span className="muted">Workbench</span>
            <span className="slash">/</span>
            {
              (
                {
                  projects: "Projetos",
                  knowledge: "Knowledge",
                  sessions: "Workspaces",
                  activity: "Atividade",
                } as Record<string, string>
              )[view]
            }
          </div>
          <span className="header-status">
            <span className="dot" /> Nenhuma chamada LLM em segundo plano
          </span>
        </header>
        <main className="content">
          {error && (
            <div role="alert" className="error">
              {error}
              <button aria-label="Fechar erro" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {view === "projects" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">CONTEXTO → EXECUÇÃO</div>
                  <h1>{project?.name ?? "Seu próximo projeto começa aqui."}</h1>
                  <p>
                    {project?.objective ||
                      "Conecte repositórios e mantenha o contexto do trabalho em um só lugar."}
                  </p>
                </div>
                <button onClick={() => setModal("project")}>
                  + Novo projeto
                </button>
              </div>
              {project ? (
                <>
                  <div className="project-meta">
                    <Badge>
                      {project.kind === "finite"
                        ? "Projeto finito"
                        : "Projeto contínuo"}
                    </Badge>
                    <span>{resources.length} repositórios</span>
                    <span>{sessions.length} worksessions</span>
                    <span>Dados locais · SQLite</span>
                  </div>
                  <section>
                    <div className="section-heading">
                      <h2>
                        Repositórios{" "}
                        <span>
                          {resources.length.toString().padStart(2, "0")}
                        </span>
                      </h2>
                      <button
                        className="secondary"
                        onClick={() => setModal("resource")}
                      >
                        + Vincular repositório
                      </button>
                    </div>
                    {resources.length ? (
                      <div className="repo-grid">
                        {resources.map((r) => (
                          <article className="repo" key={r.id}>
                            <div className="repo-top">
                              <span className="repo-icon">⌁</span>
                              <Badge>local</Badge>
                            </div>
                            <h3>{r.name}</h3>
                            <code>{r.path}</code>
                            <div className="repo-footer">
                              <button
                                className="text-button"
                                onClick={() => {
                                  setModal(`session:${r.id}`);
                                }}
                              >
                                Abrir worksession ↗
                              </button>
                              <button
                                className="text-button"
                                onClick={() =>
                                  void action(async () =>
                                    setDbt(await api(`/resources/${r.id}/dbt`)),
                                  )
                                }
                              >
                                dbt
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty>
                        Vincule um diretório local para começar. Cada sessão
                        terá seu próprio cwd.
                      </Empty>
                    )}
                  </section>
                  <section>
                    <div className="section-heading">
                      <h2>
                        Work Sessions{" "}
                        <span>
                          {sessions.length.toString().padStart(2, "0")}
                        </span>
                      </h2>
                      <span className="muted">
                        Processos independentes, contexto preservado
                      </span>
                    </div>
                    <SessionArea
                      sessions={sessions}
                      session={session}
                      select={setSessionId}
                      action={action}
                    />
                  </section>
                  <section>
                    <div className="section-heading">
                      <h2>Investigações entre repositórios</h2>
                      <button
                        className="secondary"
                        disabled={!sessions.length}
                        onClick={() => setModal("task")}
                      >
                        + Investigar
                      </button>
                    </div>
                    <p className="section-description">
                      Busca literal somente leitura. Resultado com evidências,
                      sem enviar dados a um modelo.
                    </p>
                    <Tasks
                      tasks={state!.tasks.filter(
                        (t) => t.project_id === project.id,
                      )}
                      cancel={(id) =>
                        void action(() => api(`/tasks/${id}/cancel`, {}))
                      }
                    />
                  </section>
                  {dbt && (
                    <section>
                      <div className="section-heading">
                        <h2>Metadados dbt</h2>
                        <button
                          className="text-button"
                          onClick={() => setDbt(null)}
                        >
                          Fechar ×
                        </button>
                      </div>
                      <div className="dbt-list">
                        {dbt.map((n) => (
                          <details key={n.id}>
                            <summary>
                              <Badge>{n.type}</Badge> {n.name}{" "}
                              <code>{n.path}</code>
                            </summary>
                            <p>Depende de: {n.parents.join(", ") || "—"}</p>
                            <p>Usado por: {n.children.join(", ") || "—"}</p>
                          </details>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <Empty>
                  Crie um projeto e vincule seus repositórios locais. Nenhuma
                  integração externa é necessária para começar.
                </Empty>
              )}
            </>
          )}
          {view === "sessions" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">AMBIENTES INDEPENDENTES</div>
                  <h1>Workspaces</h1>
                  <p>
                    {project?.name ?? "Crie um projeto para abrir sessões."}
                  </p>
                </div>
              </div>
              <SessionArea
                sessions={sessions}
                session={session}
                select={setSessionId}
                action={action}
              />
            </>
          )}
          {view === "knowledge" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">CONHECIMENTO TRANSVERSAL</div>
                  <h1>Regras que conectam projetos.</h1>
                  <p>Afirmações com fontes, escopo e validação humana.</p>
                </div>
                <button onClick={() => setModal("knowledge")}>
                  + Propor conhecimento
                </button>
              </div>
              {state?.knowledge.length ? (
                state.knowledge.map((k) => (
                  <article className="knowledge" key={k.id}>
                    <Badge>{k.status}</Badge>
                    <h2>{k.title}</h2>
                    <p>{k.body}</p>
                    <small>Escopo: {k.scope}</small>
                    {k.evidence.map((e, i) => (
                      <blockquote key={i}>
                        <a href={e.uri} target="_blank" rel="noreferrer">
                          {e.uri}
                        </a>
                        <p>{e.excerpt}</p>
                      </blockquote>
                    ))}
                    {k.status === "proposed" && (
                      <div className="actions">
                        <button
                          onClick={() =>
                            void action(() =>
                              api(`/knowledge/${k.id}/review`, {
                                status: "validated",
                              }),
                            )
                          }
                        >
                          Validar afirmação
                        </button>
                        <button
                          className="secondary"
                          onClick={() =>
                            void action(() =>
                              api(`/knowledge/${k.id}/review`, {
                                status: "rejected",
                              }),
                            )
                          }
                        >
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <Empty>
                  Conhecimento pertence ao domínio e pode ser consultado por
                  todos os projetos. Adicione uma afirmação com evidência.
                </Empty>
              )}
            </>
          )}
          {view === "activity" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">TRILHA LOCAL DE EXECUÇÃO</div>
                  <h1>Atividade</h1>
                  <p>
                    Eventos persistidos. Conteúdo bruto dos terminais não é
                    gravado.
                  </p>
                </div>
              </div>
              <div className="activity">
                {state?.events.map((e) => (
                  <div key={e.sequence}>
                    <span className="dot" />
                    <strong>{e.kind}</strong>
                    <code>{e.subject_id.slice(0, 20)}</code>
                    <time>
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </time>
                  </div>
                ))}
              </div>
            </>
          )}
          <footer>
            AGENTIC WORKBENCH{" "}
            <span>
              Seu trabalho, conectado. <span className="dot" /> Local-first
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <div className="overlay" onClick={() => setModal("")}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Fechar"
              onClick={() => setModal("")}
            >
              ×
            </button>
            {modal === "project" && (
              <form
                onSubmit={(e) =>
                  void submit(e, (d) =>
                    api("/projects", {
                      name: d.get("name"),
                      objective: d.get("objective"),
                      kind: d.get("kind"),
                    }),
                  )
                }
              >
                <h2 id="modal-title">Novo projeto</h2>
                <label>
                  Nome
                  <input
                    name="name"
                    required
                    maxLength={120}
                    autoFocus
                    placeholder="Migração Dataform → dbt"
                  />
                </label>
                <label>
                  Objetivo
                  <textarea name="objective" maxLength={4000} />
                </label>
                <label>
                  Tipo
                  <select name="kind">
                    <option value="finite">Finito</option>
                    <option value="continuous">Contínuo</option>
                  </select>
                </label>
                <button disabled={busy}>Criar projeto</button>
              </form>
            )}
            {modal === "resource" && (
              <form
                onSubmit={(e) =>
                  void submit(e, (d) =>
                    api(`/projects/${project!.id}/resources`, {
                      name: d.get("name"),
                      path: d.get("path"),
                    }),
                  )
                }
              >
                <h2 id="modal-title">Vincular repositório</h2>
                <label>
                  Nome
                  <input name="name" required autoFocus />
                </label>
                <label>
                  Caminho absoluto
                  <input
                    name="path"
                    required
                    placeholder="/home/voce/repos/airflow"
                  />
                </label>
                <p>
                  Você está autorizando o acesso a este diretório. Sessões de
                  terminal permitem comandos com as permissões do seu usuário.
                </p>
                <button disabled={busy}>Vincular diretório</button>
              </form>
            )}
            {modal.startsWith("session:") && (
              <form
                onSubmit={(e) =>
                  void submit(e, async (d) => {
                    const s = await api<Worksession>("/worksessions", {
                      project_id: project!.id,
                      resource_id: modal.split(":")[1],
                      provider: d.get("provider"),
                    });
                    setSessionId(s.id);
                  })
                }
              >
                <h2 id="modal-title">Nova worksession</h2>
                <label>
                  Ambiente
                  <select name="provider">
                    <option value="shell">Bash / Shell</option>
                    <option value="codex">Codex CLI</option>
                    <option value="claude">Claude Code CLI</option>
                  </select>
                </label>
                <p>
                  O CLI precisa estar instalado e autenticado. Iniciar um
                  provedor externo pode enviar contexto à nuvem. Nada é iniciado
                  até você clicar em “Iniciar terminal”.
                </p>
                <button disabled={busy}>Criar sessão</button>
              </form>
            )}
            {modal === "task" && (
              <form
                onSubmit={(e) =>
                  void submit(e, (d) =>
                    api("/tasks", {
                      project_id: project!.id,
                      target_workspace_id: d.get("target"),
                      objective: d.get("objective"),
                      query: d.get("query"),
                      mode: "read_only",
                      idempotency_key: crypto.randomUUID(),
                    }),
                  )
                }
              >
                <h2 id="modal-title">Investigar outro repositório</h2>
                <label>
                  Sessão destino
                  <select name="target">
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {resources.find((r) => r.id === s.resource_id)?.name ??
                          s.cwd}{" "}
                        · {s.provider}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Objetivo
                  <textarea
                    name="objective"
                    required
                    placeholder="Localizar DAGs que usam o modelo de pagamentos"
                  />
                </label>
                <label>
                  Texto a localizar
                  <input
                    name="query"
                    required
                    maxLength={200}
                    placeholder="payments"
                  />
                </label>
                <p>
                  Adaptador local: leitura de arquivos limitada, sem comandos
                  arbitrários ou interpretação por IA.
                </p>
                <button disabled={busy}>Solicitar investigação →</button>
              </form>
            )}
            {modal === "knowledge" && (
              <form
                onSubmit={(e) =>
                  void submit(e, (d) =>
                    api("/evidence", {
                      title: d.get("title"),
                      body: d.get("body"),
                      scope: d.get("scope"),
                      evidence: [
                        { uri: d.get("uri"), excerpt: d.get("excerpt") },
                      ],
                    }),
                  )
                }
              >
                <h2 id="modal-title">Propor conhecimento</h2>
                <label>
                  Título
                  <input name="title" required autoFocus />
                </label>
                <label>
                  Afirmação
                  <textarea name="body" required />
                </label>
                <label>
                  Escopo
                  <input name="scope" required placeholder="Payments / TPV" />
                </label>
                <label>
                  URL da evidência
                  <input name="uri" type="url" required />
                </label>
                <label>
                  Trecho da fonte
                  <textarea name="excerpt" required />
                </label>
                <button disabled={busy}>Registrar proposta</button>
              </form>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function SessionArea({
  sessions,
  session,
  select,
  action,
}: {
  sessions: Worksession[];
  session?: Worksession;
  select: (id: string) => void;
  action: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [context, setContext] = useState<{
    git: { branch: string | null; status: string; diff: string };
    instructions: Record<string, string>;
  }>();
  useEffect(() => {
    setContext(undefined);
    if (session)
      void api<typeof context>(`/worksessions/${session.id}/context`)
        .then(setContext)
        .catch(() => {});
  }, [session?.id, session?.state]);
  return sessions.length ? (
    <div className="session-panel">
      <div className="tabs">
        {sessions.map((s) => (
          <button
            className={session?.id === s.id ? "active" : ""}
            key={s.id}
            onClick={() => select(s.id)}
          >
            <span
              className={`dot ${s.state === "running" ? "" : "inactive"}`}
            />
            {s.cwd.split("/").pop()} <small>{s.provider}</small>
          </button>
        ))}
      </div>
      {session && (
        <>
          <div className="terminal-toolbar">
            <code>{session.cwd}</code>
            <div>
              <Badge>{session.state}</Badge>
              {session.state === "running" ? (
                <button
                  className="text-button"
                  onClick={() =>
                    void action(() =>
                      api(`/worksessions/${session.id}/stop`, {}),
                    )
                  }
                >
                  Encerrar ■
                </button>
              ) : (
                <button
                  className="text-button"
                  onClick={() =>
                    void action(() =>
                      api(`/worksessions/${session.id}/start`, {}),
                    )
                  }
                >
                  Iniciar terminal ▷
                </button>
              )}
            </div>
          </div>
          {session.state === "running" ? (
            <Suspense
              fallback={
                <div className="terminal-placeholder">Carregando terminal…</div>
              }
            >
              <Terminal key={session.id} id={session.id} />
            </Suspense>
          ) : (
            <div className="terminal-placeholder">
              <span>⌘</span>
              <h3>
                {session.state === "interrupted"
                  ? "Sessão recuperada após reinício"
                  : "Tudo pronto para começar."}
              </h3>
              <p>Inicie o terminal para trabalhar neste diretório.</p>
            </div>
          )}
          {context && (
            <details className="session-context">
              <summary>
                Contexto · branch {context.git.branch ?? "—"} ·{" "}
                {Object.keys(context.instructions).length} arquivo(s) de
                instruções
              </summary>
              <pre>
                {context.git.status || "Git limpo"}
                {context.git.diff}
              </pre>
              {Object.entries(context.instructions).map(([name, text]) => (
                <details key={name}>
                  <summary>{name}</summary>
                  <pre>{text}</pre>
                </details>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  ) : (
    <Empty>
      Abra uma worksession a partir de um repositório. Terminais são iniciados
      apenas por você.
    </Empty>
  );
}
function Tasks({
  tasks,
  cancel,
}: {
  tasks: Task[];
  cancel: (id: string) => void;
}) {
  return tasks.length ? (
    <div className="tasks">
      {[...tasks].reverse().map((t) => (
        <details key={t.id}>
          <summary>
            <span
              className={`dot ${t.state === "completed" ? "" : "inactive"}`}
            />
            <strong>{t.objective}</strong>
            <Badge>{t.state}</Badge>
          </summary>
          <div className="task-body">
            <code>{t.id}</code>
            {["queued", "running"].includes(t.state) && (
              <button className="secondary" onClick={() => cancel(t.id)}>
                Cancelar
              </button>
            )}
            {t.error && <p className="error">{t.error}</p>}
            {t.result && <Result result={t.result} />}
          </div>
        </details>
      ))}
    </div>
  ) : (
    <Empty>
      Nenhuma investigação ainda. Delegue uma busca a outra worksession para
      conectar o contexto.
    </Empty>
  );
}
function Result({ result }: { result: InvestigationResult }) {
  return (
    <>
      <p>{result.summary}</p>
      {result.evidence.map((e, i) => (
        <div className="evidence" key={i}>
          <code>
            {e.path}:{e.line}
          </code>
          <pre>{e.excerpt}</pre>
          <small>Git: {e.revision ?? "sem revisão"}</small>
        </div>
      ))}
      <p className="muted">{result.limitations.join(" ")}</p>
      <small>
        {result.files_read.length} arquivos lidos · {result.usage.llm_calls}{" "}
        chamadas LLM · US$ 0
      </small>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
