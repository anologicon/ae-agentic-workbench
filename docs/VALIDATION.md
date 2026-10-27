# Validação do preview 0.1.0

Executada em 27/10/2026 no ambiente Linux x64, Node 24.19.0, npm 11.9.0, Git 2.52.0 e Chromium headless.

- `npm test`: 5 testes passaram. Cobrem API autenticada, rejeição de origem, três PTYs reais, resize/input e cwd, compartilhamento de recursos, idempotência, investigação, conhecimento cross-project, revisão humana, manifest dbt, recuperação, symlinks, cancelamento, profundidade, concorrência, timeout e falha de worker.
- O teste MCP usa um processo stdio separado com cliente e servidor do SDK oficial, enfileira uma tarefa e consulta seu resultado no runtime HTTP real.
- `npm run build`, `npm run lint` e `npm run format:check`: passaram.
- Teste exploratório no Chromium: pareamento, terminal xterm, investigação no Airflow com evidências, criação e validação de conhecimento. Nenhum erro JavaScript da página.
- Inspeção de layout em 1440 × 1100 e 390 × 844; navegação móvel e ausência de overflow horizontal verificadas.
- Demo executada com três repositórios Git e sessões independentes.

O teste exploratório de navegador foi executado com `playwright-core` e Chromium do ambiente; não é parte do comando `npm test` nem da CI inicial. Os testes automatizados reproduzíveis ficam em `tests/`.

Não foram validados nesta entrega: autenticação real de provedores, execução programática/retomada de Codex ou Claude, bindings DuckDB/Ladybug, Chrome Extension/Native Messaging, Slack/Jira e outros sistemas operacionais. A CI foi definida no repositório, sem execução remota presumida.
