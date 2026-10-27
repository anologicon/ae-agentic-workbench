# Estado da implementação — 0.1.0

Este repositório inicia a execução do plano. **Não representa a V1 completa.** O README e o plano originais foram preservados como especificação; esta página distingue o que foi implementado das etapas futuras.

## Incremento entregue

- Monorepo npm / TypeScript, React/Vite, lint, formatter, testes e workflow CI.
- Runtime Express em loopback; pareamento local, cookie HttpOnly/SameSite, verificação de Host/Origin e autenticação de WebSocket.
- Criação, consulta e atualização de projetos finitos/contínuos; cadastro e compartilhamento de repositório entre projetos.
- Worksessions por cwd e provedor; PTY real, xterm, input, resize, start/stop e buffer volátil limitado. Provedores disponíveis como processos interativos (`codex`, `claude`), se instalados.
- SQLite com transações, vínculos, eventos de auditoria e recuperação de metadados. Sessões/tarefas ativas são interrompidas após restart, sem replay automático.
- Coordenador de busca local com fila persistida, idempotência, profundidade 1, concorrência 2, serialização por sessão, timeout e cancelamento.
- Adaptador determinístico somente leitura: busca literal limitada, sem LLM, evidências com path/linha/URI/revisão, arquivos lidos, limitações e custo zero.
- MCP stdio com oito ferramentas; chamada real cliente SDK → servidor MCP → API → worker → resultado persistido validada em teste.
- Conhecimento transversal com evidências e estados; propostas via MCP e validação humana somente pela sessão local da UI.
- Git branch/status/diff estatístico e instruções locais; inventário e dependências diretas do manifest dbt, sem executar dbt ou inferência.
- Demo com três repositórios Git e três worksessions, sem integração corporativa.

## Relação com os tickets do plano

| Ticket | Situação neste incremento                                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| AW-001 | Bootstrap e comandos implementados; CI definida, ainda não executada em hospedagem remota.                                       |
| AW-002 | Auth/loopback/health/Host/Origin/WS implementados. Pareamento por segredo local; keychain futuro.                                |
| AW-003 | Criar/listar/consultar/atualizar e vincular recursos. Remoção/arquivamento ainda pendentes.                                      |
| AW-004 | PTY real com três cwd, resize e encerramento testados em Linux. Outros SO pendentes.                                             |
| AW-005 | Metadados e recuperação implementados. Retomada de sessão do provedor pendente.                                                  |
| AW-006 | Integração interativa CLI. App Server / Agent SDK programático pendente.                                                         |
| AW-007 | Coordenador local testado. Dependências entre tarefas, aprovações de escrita e orçamento de LLM pendentes.                       |
| AW-008 | Servidor stdio e cliente SDK integrados; configuração de cliente externo documentada. Uso com agente real ainda exige validação. |
| AW-009 | Busca controlada entre repositórios demonstrada. Delegação com interpretação por agente e sandbox de provedor pendentes.         |
| AW-010 | Afirmações, evidências, revisão e recuperação cross-project. Relações tipadas e validade temporal pendentes.                     |
| AW-011 | Git e manifest/lineage direto implementados; grafo visual e dbt MCP pendentes.                                                   |
| AW-012 | DuckDB/Ladybug e outbox de projeções ainda não implementados. SQLite provisório conforme permitido no plano.                     |
| AW-013 | Extensão Chrome e bridge ainda não implementadas.                                                                                |
| AW-014 | Jira draft, aprovação e publicação ainda não implementados.                                                                      |
| AW-015 | Testes de API, PTY, MCP, fila, recuperação e navegador. Hardening/release completos pendentes.                                   |

## Próxima etapa do plano

Priorizar o gate G0/G2: adaptador programático de um provedor, execução isolada com read-only verificável, status/retomada e autorização explícita do contexto enviado à nuvem. Depois validar DuckDB/Ladybug e outbox reconstruível. Chrome/Slack/Jira continuam condicionados às permissões reais da organização.

Não foi chamado nenhum modelo remoto pelo runtime/coordenador durante a validação. O fluxo local não equivale à colaboração autônoma completa entre Codex e Claude.
