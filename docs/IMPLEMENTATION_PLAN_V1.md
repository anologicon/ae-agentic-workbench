# Plano de implementação — V1

> **Produto:** Agentic Workbench  
> **Abordagem:** vertical slices, local-first, escopo limitado, validação real com dbt + Dataform + Airflow.  
> **Estado:** plano proposto; nenhuma implementação ou integração corporativa é presumida existente.

## 1. Objetivo e recorte da V1

Entregar um **Workbench web local utilizável** que permita:

1. organizar projetos genéricos e associar-lhes repositórios e recursos;
2. iniciar worksessions/terminais independentes com Claude Code e Codex;
3. solicitar uma investigação entre repositórios através de um **coordenador local + MCP próprio**, preservando contexto, permissões e evidências;
4. consultar conhecimento de negócio compartilhado sem mantê-lo preso a um projeto;
5. usar o **Chrome atual** para associar a página/thread em foco a projeto/tarefa sem copiar link;
6. produzir um rascunho de Jira a partir do contexto, com publicação controlada;
7. navegar pelos metadados dbt e Git, sem investir em um editor de código.

### Hipótese a validar

> Um agente em um repositório consegue descobrir e solicitar trabalho relevante em outro repositório, recuperar conhecimento de negócio confiável e agir entre aplicações **com menos intervenção manual**, sem multiplicar contextos, custo de tokens ou permissões.

### Não objetivos V1

Não construir: IDE/editor completo, agentes que modificam a si mesmos, acompanhamento permanente de Slack, execução automática em produção, ingestão de todo o conhecimento corporativo, gerenciamento multiusuário, dashboards BI, suporte profundo a Dataform/Airflow via parsing proprietário ou um gateway MCP obrigatório.

## 2. Entregas por prioridade

| ID | Prioridade | Entrega | Aceite verificável |
|---|---|---|---|
| F01 | P0 | Runtime HTTP/WebSocket somente local | UI conecta a API autenticada em loopback; não expõe porta externa |
| F02 | P0 | Projetos e recursos | Projeto finito/contínuo aceita 3 repositórios e links externos; mesmo recurso pertence a mais de um projeto |
| F03 | P0 | Terminal PTY | 3 terminais Bash independentes, cwd específico, resize, start/stop e logs locais |
| F04 | P0 | Provider sessions | Claude Code e Codex executam em terminais; pelo menos um tem retomada programática validada |
| F05 | P0 | Coordenador de tarefas | Estados e fila persistidos; `request_task` entre dbt e Airflow, somente leitura; resultado correlacionado |
| F06 | P0 | MCP Workbench | `list_workspaces`, `request_task`, `get_task`, `get_project_context` funcionam em cliente real |
| F07 | P0 | Política de execução | Bloqueio de escrita por padrão, permissões e aprovações por tarefa, limites de delegação |
| F08 | P1 | Contexto compartilhado | Registrar regra/hipótese/evidência e recuperá-las em duas sessões diferentes |
| F09 | P1 | dbt/Git Explorer básico | Ler `manifest.json`, listar modelos/dependências, mostrar branch/status/diff |
| F10 | P1 | Persistência e observabilidade | Reinício recupera projetos, tasks, relações e sessão referenciada; eventos rastreáveis |
| F11 | P1 | Chrome Context Bridge | Na thread/página atual, associar identificador/URL a projeto com ação explícita |
| F12 | P1 | Jira draft | Gerar rascunho a partir de contexto; criar/atualizar via integração autorizada após confirmação |
| F13 | P1 | DuckDB + Ladybug MVP | Snapshot no DuckDB e grafo de 3 tipos de relação no Ladybug; projeções reexecutáveis |
| F14 | P2 | Empacotamento e DX | Bootstrap reproduzível; pelo menos um SO alvo testado end-to-end |

**Regra de release:** F01–F10 devem funcionar em ambiente controlado. F11–F12 dependem de permissões corporativas; se bloqueadas, a V1 pode sair como **preview técnico**, mas não deve ser anunciada como fluxo Chrome → Jira completo.

## 3. Arquitetura de implementação

### Camadas

```mermaid
flowchart LR
  WEB[Web React] --> RUNTIME[Runtime local Node/TS]
  CHROME[Chrome Extension] --> BRIDGE[Native Messaging Host]
  BRIDGE --> RUNTIME
  RUNTIME --> SESS[Session Manager / PTY]
  RUNTIME --> TASK[Task Coordinator]
  RUNTIME --> KNOW[Knowledge API]
  MCP[MCP Workbench] --> TASK
  MCP --> KNOW
  SESS --> AGENTS[Claude Code / Codex]
  TASK --> AGENTS
  TASK --> CLIENT[MCP Client / CLI Integrations]
  CLIENT --> APPS[dbt / Git / Slack / Jira]
  TASK --> SQLITE[(SQLite)]
  KNOW --> SQLITE
  KNOW --> DUCK[(DuckDB)]
  KNOW --> LADY[(LadybugDB)]
```

### Interfaces técnicas propostas

**Runtime API (HTTP local + WebSocket):**

- `POST /projects`, `GET /projects/:id`, `POST /projects/:id/resources`;
- `POST /worksessions`, `POST /worksessions/:id/start`, `POST /worksessions/:id/stop`;
- `WS /terminals/:id` (bytes de PTY, resize, disconnect);
- `POST /tasks`, `GET /tasks/:id`, `POST /tasks/:id/approve`, `POST /tasks/:id/cancel`;
- `POST /evidence`, `GET /projects/:id/context`, `GET /knowledge/search`;
- `POST /browser/capture` (apenas por ponte autenticada; conteúdo mínimo necessário).

Essas rotas são **contratos propostos**, não endpoints implementados.

**MCP Workbench (stdio local no primeiro momento):**

```text
workbench.list_projects
workbench.list_workspaces
workbench.get_project_context
workbench.find_knowledge
workbench.request_task
workbench.get_task_status
workbench.get_task_result
workbench.register_evidence
```

As ferramentas expõem operações tipadas, e não `execute_any_shell_command` irrestrito. `register_evidence` cria evidência/afirmação candidata, não altera automaticamente uma regra validada.

### Envelope de delegação (v1)

```json
{
  "task_id": "tsk_123",
  "parent_task_id": "tsk_100",
  "project_id": "prj_migracao",
  "target_workspace_id": "ws_airflow",
  "objective": "Localize as DAGs que acionam a transformação X",
  "mode": "read_only",
  "context_refs": ["resource:dbt/model_x", "evidence:decision_42"],
  "approval_policy": "required_for_writes",
  "max_depth": 1,
  "timeout_seconds": 300,
  "budget_usd": 1.00,
  "idempotency_key": "prj_migracao:tsk_100:airflow-check"
}
```

**Resposta obrigatória:** status, resumo, evidências (`uri`, repo/path/line/revisão quando disponível), arquivos lidos, limitações, ações executadas e estimativa/consumo observável. O resultado é **uma mensagem estruturada**, não todo o histórico do agente filho.

### Máquina de estados da tarefa

```text
created → queued → running → completed
                   ↘ awaiting_approval → queued
                   ↘ failed | cancelled | timed_out
```

- `request_task` retorna imediatamente `task_id`; não mantém chamada MCP aberta durante investigação longa.
- `get_task_status`/`get_task_result` consultam resultado persistido; callbacks e notificações ficam para evolução posterior.
- Se um agente alvo está ocupado, enfileirar; não digitar texto arbitrário num terminal aberto.
- Uma tarefa em execução não pode delegar indiscriminadamente; V1 limita profundidade a **1** e concorrência a **2** trabalhos com LLM por padrão (configurável).
- Processos terminados por falha/restart entram em `interrupted`; a retomada depende da API do provedor e **não** pressupõe que o processo permaneça vivo.

## 4. Decisões tecnológicas iniciais

| Peça | Tecnologia | Decisão/racional |
|---|---|---|
| Frontend | React + Vite + TypeScript | Web local primeiro; Tauri/Electron não entram em V1 |
| Backend | Node.js + TypeScript | Integra MCP, PTY e CLI com menos camadas |
| PTY | xterm.js + node-pty | Terminais reais; testar shell/encoding no SO alvo |
| MCP | SDK TypeScript, stdio | O próprio Workbench é servidor MCP; gateways são opcionais |
| Operacional | SQLite | Estado da fila, aprovação, eventos e sessões; escrita concentrada |
| Analítico | `@duckdb/node-api` | Metadados dbt e snapshots locais; sem armazenar indiscriminadamente dados brutos |
| Grafo | `@ladybugdb/core` | Conhecimento e relacionamentos tipados; validar bindings do SO alvo |
| Git | Git CLI | Branch, worktree, diff e status sob permissão |
| dbt | artefatos locais + `dbt-mcp` | `manifest.json` é o ponto de partida; MCP para ações sob permissão |
| Codex | CLI + App Server | API de threads/turns, progresso e retomada conforme versão instalada |
| Claude | Claude Code CLI + Agent SDK | Interatividade e integração programática a validar em spike |
| Chrome | Manifest V3 + Native Messaging | Captura explícita do contexto da aba atual |
| Slack/Jira | MCP/API autorizada | Dependem da organização, escopos e limites de taxa |

**Observação:** a existência de MCP não implica que todos os dados estejam acessíveis. O contrato de permissões da aplicação corporativa prevalece.

### Política de persistência

- SQLite é a **origem transacional** das referências, estados e eventos.
- DuckDB e Ladybug são **projeções reconstruíveis** de dados extraídos/validados.
- Usar IDs canônicos e `source_id` + `external_id` + `revision` quando existir.
- A outbox do SQLite registra alterações para projeção. Consumidores aplicam eventos idempotentes, mantêm offset e podem repetir eventos após falha.
- Duas fontes podem discordar: a relação registra evidência, tipo (`declared`, `observed`, `inferred`, `validated`) e validade temporal. Nunca ocultar conflito.
- Se Ladybug ou DuckDB bloquearem o SO alvo/empacotamento, não impedir a validação do fluxo P0; documentar o bloqueio e permitir implementação provisória com SQLite até corrigir o spike.

## 5. Plano por fases e checkpoints

Os prazos abaixo são **faixas indicativas de planejamento**, não compromissos: cerca de **10–14 semanas em dedicação significativa**, com variação forte conforme SO, restrições corporativas e SDKs. Critérios de aceite, não datas, decidem a passagem de fase.

### Fase 0 — Viabilidade técnica e acesso (semana 0–1)

**Atividades**

- [ ] Identificar SO alvo, shell, Node, Python, dbt Core, Git, Claude Code e Codex disponíveis.
- [ ] Verificar políticas corporativas de Chrome Extension, Slack App, Jira API e envio de dados para modelos externos.
- [ ] Abrir PTY com xterm.js/node-pty em um protótipo local.
- [ ] Rodar Claude/Codex em diretórios de repositórios distintos sem trocar `cwd` ou instruções.
- [ ] Fazer POC `Codex App Server` e `Claude Agent SDK` (sessão/streaming/retomada).
- [ ] Fazer POC `@duckdb/node-api` e `@ladybugdb/core` no mesmo runtime/OS.

**Gate G0:** terminal funciona, um provedor programático funciona e riscos de integração corporativa estão documentados. Caso negativo: ajustar stack antes do monorepo.

### Fase 1 — Project Cockpit + Worksessions (semanas 1–3)

**Atividades**

- [ ] Inicializar monorepo, lint, format, testes, CI e ADRs.
- [ ] Criar tabelas `projects`, `resources`, `project_resources`, `worksessions`, `sessions`, `events`.
- [ ] CRUD de projeto finito/contínuo; adicionar 3 repositórios locais.
- [ ] Terminal web com `cwd` por repositório, tabs, start/stop, resize, stream e captura de logs (sem segredos).
- [ ] Exibir sessão, agent provider, estado, path, branch e instruções locais.
- [ ] Persistir sessão referenciada e restaurar **metadados** após restart.

**Gate G1:** três terminais do mesmo projeto funcionando em repositórios distintos; fechamento da UI não corrompe estado.

### Fase 2 — MCP e colaboração entre agentes (semanas 3–6)

**Atividades**

- [ ] Implementar `tasks`, `task_events`, `task_dependencies`, `approvals`, `outbox` em SQLite.
- [ ] Criar `Task Coordinator` com limite de concorrência, idempotência, timeout, cancelamento e trilha de auditoria.
- [ ] Expor servidor MCP `request_task/get_task_*` e o primeiro cliente real (Claude ou Codex).
- [ ] Criar adaptador para invocar trabalho no repositório destino (sem digitar no terminal já ocupado).
- [ ] Habilitar delegação **read-only** dbt → Airflow → resposta estruturada.
- [ ] Confirmar não escrita e não execução de comandos perigosos no modo de leitura por política/sandbox; auditar ferramentas permitidas.
- [ ] Testar falha do worker, cancelamento, timeouts, reinício e tarefa duplicada.

**Gate G2 (principal):** um agente dbt consulta o agente Airflow, obtém evidência com arquivo/revisão e vê resultado na mesma tarefa, sem intervenção para copiar contexto.

### Fase 3 — Context Engine + Git/dbt (semanas 6–8)

**Atividades**

- [ ] Criar entidades `knowledge_items`, `claims`, `evidence`, `relations`, `resource_revisions`.
- [ ] Diferenciar `proposed`, `validated`, `rejected`, `superseded`; exigir confirmação para `validated`.
- [ ] Registrar 1 regra de negócio e 2 evidências associadas; reutilizar entre 2 projetos.
- [ ] Indexar metadados de `manifest.json` (modelos, sources, parents, children) e armazenar snapshot no DuckDB.
- [ ] Projetar grafo mínimo no Ladybug: `PROJECT_USES_RESOURCE`, `MODEL_DEPENDS_ON`, `CLAIM_SUPPORTED_BY`.
- [ ] Criar tela de visão estrutural dbt: lista, filtros e lineage limitado; Git status/diff/branch.
- [ ] Expor `get_project_context` e `find_knowledge` via MCP, com saída curta e links para evidências.
- [ ] Medir consulta determinística sem chamada de LLM.

**Gate G3:** regra validada recuperada de sessões em dois repositórios; lineage renderiza sem LLM; projeções podem ser reconstruídas.

### Fase 4 — Chrome → projeto → Jira (semanas 8–10)

**Atividades**

- [ ] Criar extensão Chrome MV3 com ação explícita “Capturar aba atual”.
- [ ] Integrar via Native Messaging ou ponte local segura; exigir autenticação e verificar origem.
- [ ] Implementar reconhecimento **restrito e testado** de URL/identificador de thread Slack; sem scraping permanente.
- [ ] Associar recurso ao projeto/tarefa; guardar link, ID, horário e conteúdo mínimo autorizado.
- [ ] Recuperar replies via API/MCP **somente se permitido**; senão exibir cobertura limitada e não simular leitura completa.
- [ ] Gerar rascunho Jira com título, problema, escopo, aceite, fontes e incertezas; pedir aprovação antes de criar.
- [ ] Criar/atualizar Jira via integração autorizada e guardar `external_id`; detectar duplicatas e erros de permissão.

**Gate G4:** com permissões disponíveis, associar thread atual sem copiar URL e preparar card rastreável; escrita exige confirmação. Caso permissões ausentes, registrar bloqueio externo e demonstrar com fixture não sensível.

### Fase 5 — Hardening, métricas e release preview (semanas 10–14)

**Atividades**

- [ ] Testes integrados: três repositórios fictícios, uma demanda, dois agentes e uma regra cross-project.
- [ ] Endurecer bind em loopback, autenticação local, allowlist de origem, proteção CSRF/origin, armazenamento de tokens do SO.
- [ ] Testar *prompt injection* em thread e evidências; impedir execução de instruções vindas de fontes externas.
- [ ] Exibir aprovações pendentes, custo reportado/estimado e histórico das ferramentas acionadas.
- [ ] Implementar export/import de estado e backup consistente por engine, com instrução de restore.
- [ ] Criar instalador/script de desenvolvimento para SO alvo e documentação de troubleshooting.
- [ ] Sessão de uso real com 3 fluxos repetidos; registrar fricções antes de expandir features.

**Gate de release:** critérios de aceite críticos atendidos, sem permissões implícitas, testes de recuperação verdes e limitações documentadas.

## 6. Backlog inicial detalhado (primeiros tickets)

| Ticket | Título | Depende de | Critério objetivo |
|---|---|---|---|
| AW-001 | Bootstrap monorepo TS e testes | — | `install`, `test`, `dev` padronizados |
| AW-002 | Runtime local com auth e healthcheck | AW-001 | Somente loopback; origem recusada fora da allowlist |
| AW-003 | CRUD de Project / Resource | AW-002 | Recurso vinculado a 2 projetos; ciclo de vida opcional |
| AW-004 | Terminal PTY e UI xterm | AW-002 | 3 terminais, 3 `cwd`, resize e kill |
| AW-005 | Worksession persistente | AW-003,004 | Sessão registrada/retomável quando suportada |
| AW-006 | Adapter Codex/Claude prova de conceito | AW-004 | Teste de iniciação, progresso, cancelamento e retomada |
| AW-007 | Task queue SQLite + eventos | AW-002 | Idempotência, 2 tarefas concorrentes e timeout |
| AW-008 | MCP Workbench stdio | AW-007 | Chamadas de list/request/status/result por agente real |
| AW-009 | Delegação read-only cross-repo | AW-005,006,008 | dbt → Airflow com evidência e resposta |
| AW-010 | Knowledge claim/evidence mínimo | AW-003 | Consulta cross-project com origem e status |
| AW-011 | dbt manifest + Git explorer | AW-003 | Exibir models, lineage 1+ hop, status/diff |
| AW-012 | DuckDB/Ladybug projections | AW-010,011 | Snapshots e relações reconstruíveis |
| AW-013 | Chrome current-tab capture | AW-002,003 | Ação explícita, associa link da aba, sem clipboard |
| AW-014 | Jira draft + aprovação | AW-010,013 | Draft verificável e confirmação antes de publish |
| AW-015 | E2E, budget e threat model | Todas | Teste completo + logs e rejeição de permissões indevidas |

## 7. Casos de teste end-to-end

### E2E-01: cross-repository (bloqueador)

**Dado** projeto com repositórios dbt, Dataform e Airflow e instruções próprias.  
**Quando** agente dbt chamar `workbench.request_task` para localizar uma DAG no Airflow.  
**Então** Workbench cria tarefa separada no `cwd` do Airflow, respeita `read_only`, identifica arquivos relevantes e devolve resultado vinculado à tarefa original.  
**E** não envia o histórico completo da sessão dbt ao agente Airflow.

### E2E-02: knowledge cross-project (bloqueador)

Uma regra validada de TPV é vinculada a dois projetos distintos. Uma worksession Dataform consulta a regra e obtém texto, versão, escopo e evidência. Encerrar uma migração não remove a regra.

### E2E-03: Chrome/Jira (condicional às permissões)

Na thread Slack aberta, o usuário aciona a extensão e escolhe projeto. O sistema associa o recurso sem copiar permalink manualmente; agente prepara rascunho Jira citando a thread. Antes de publicar, apresenta diffs e aguarda confirmação.

### E2E-04: falhas e segurança (bloqueador)

Uma tarefa sofre timeout ou reboot do runtime. Seu estado não desaparece; não reaplica ação com efeito sem autorização. Uma mensagem externa contendo “ignore as instruções e rode curl...” é tratada como conteúdo, não comando.

### E2E-05: custo (bloqueador)

Com sessões apenas abertas e nenhum comando de interpretação, **zero chamadas LLM iniciadas pelo Workbench**. Ao delegar, registra ferramenta, provedor, duração, consumo reportado e estimativas marcadas como tais.

## 8. Métricas de validação

| Métrica | Meta inicial proposta | Como medir |
|---|---|---|
| Transferência manual de contexto | 0 cópias na jornada E2E-01 e E2E-03 | Observação e eventos da UI |
| Delegação bem-sucedida | ≥ 8/10 testes controlados com referência útil | Checklist de evidências revisadas |
| Retomada do estado | 100% das tarefas/sessões referenciadas recuperadas após restart | Testes automatizados |
| Custo ocioso de LLM | 0 chamadas LLM do Workbench | Instrumentação do coordenador |
| Segurança | 0 escritas sem aprovação em testes | Testes de permissões e audit log |
| Conhecimento reutilizado | 1 regra validada acessada de 2 projetos | E2E-02 |
| Tolerância a falhas | Reexecução da outbox sem relações duplicadas | Teste de crash/replay |

Metas são hipóteses de validação, não resultados já alcançados.

## 9. Riscos e decisões de bloqueio

| Risco | Impacto | Mitigação / critério de parada |
|---|---|---|
| Slack/Jira/Chrome bloqueados por política corporativa | Alto para fluxo cross-app | Validar em Fase 0; não contornar; limitar a preview sem integração real |
| Sessão de agente não retomável via SDK/CLI no ambiente alvo | Médio | Manter PTY e metadados; não prometer restauração transparente |
| Delegação via terminal interativo frágil | Alto | Nunca injetar texto em terminal ocupado; criar execução isolada via adaptador |
| Uso de três bancos aumenta manutenção | Médio-alto | SQLite canônico, DuckDB/Ladybug projeções; POC obrigatória e rebuild |
| Conteúdo externo malicioso / *prompt injection* | Alto | Escopo read-only, validação, aprovação, isolamento e auditoria |
| Estouro de tokens por loops entre agentes | Alto | Profundidade 1, orçamento, timeout e concorrência limitados |
| Dataform/Airflow têm estruturas variadas | Médio | Primeiro tratar como repositórios genéricos; adaptadores especializados depois |
| Licenças, termos e autenticação dos provedores | Alto | Revisar SDKs, redistribuição, cobrança/limites e uso autorizado antes de empacotar |
| Dados corporativos enviados a Claude/Codex | Alto | Seleção mínima, revisão de contexto, política explícita e autorização |
| Escopo crescente | Muito alto | Não aceitar feature que não melhore as 3 jornadas V1 |

## 10. Decisões arquiteturais a registrar (ADRs)

1. **ADR-001:** web localhost antes de Electron/Tauri.
2. **ADR-002:** separar *trabalho* (tasks) de *processos* (PTY/session).
3. **ADR-003:** Knowledge Items independentes de projetos.
4. **ADR-004:** SQLite canônico; DuckDB e Ladybug como projeções reconstruíveis.
5. **ADR-005:** MCP como ferramenta/protocolo de comunicação, não como coordenador.
6. **ADR-006:** execução read-only por padrão, escrita exige aprovação.
7. **ADR-007:** integrações externas por APIs/MCP oficiais primeiro; browser apenas quando necessário.
8. **ADR-008:** tokens só sob demanda, com orçamento por tarefa.

## 11. Primeiro sprint recomendado

**Objetivo:** ver o produto funcionando antes de investir em integrações remotas.

- [ ] Criar monorepo e API local.
- [ ] Abrir dashboard simples com lista de projetos e 3 repositórios.
- [ ] Implementar componente terminal `xterm.js` conectado a `node-pty`.
- [ ] Rodar Bash em três `cwd` diferentes.
- [ ] Abrir Claude Code e Codex em sessões individuais.
- [ ] Guardar estado mínimo de worksessions no SQLite.
- [ ] Criar teste exploratório do primeiro pedido dbt → Airflow via mecanismo controlado.

**Demonstração esperada:** selecionar um projeto, alternar entre três terminais reais e disparar uma investigação controlada em um repositório diferente (ainda que inicialmente com adaptador simples, sem IA autônoma plena).

## 12. Referências a validar durante a implementação

- [dbt MCP](https://github.com/dbt-labs/dbt-mcp) e [artefatos `manifest.json`](https://docs.getdbt.com/reference/artifacts/manifest-json)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript)
- [DuckDB Node API](https://duckdb.org/docs/lts/clients/node_neo/overview)
- [LadybugDB Node](https://docs.ladybugdb.com/client-apis/nodejs/) e [instalação](https://docs.ladybugdb.com/installation/)
- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Slack Events API / Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/) e [conversations.replies](https://docs.slack.dev/reference/methods/conversations.replies/)
- [Docker MCP Gateway](https://docs.docker.com/ai/mcp-catalog-and-toolkit/mcp-gateway/) — **opcional**

---

**Definição de pronto da V1:** o usuário consegue coordenar trabalho entre repositórios e aplicações usando agentes, com conhecimento reutilizável, estado local, evidências, aprovações e custo controlado — sem depender de um editor próprio nem de infraestrutura SaaS do Workbench.
