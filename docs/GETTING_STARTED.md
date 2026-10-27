# Executar o preview local

## Requisitos

- Node.js 24 ou superior (SQLite nativo de `node:sqlite`).
- npm 11, Git e Bash no Linux/macOS; PowerShell no Windows.
- Para compilar `node-pty` se não houver binário: Python 3 e compilador C/C++ (`build-essential` no Ubuntu; ferramentas equivalentes no seu SO).
- Codex CLI / Claude Code são opcionais. Instale e autentique cada CLI separadamente antes de abrir uma sessão desse provedor.

O ambiente validado foi Linux x64, Node 24.19, npm 11.9 e Bash. Windows e macOS ainda exigem validação de PTY. `npm start` executa TypeScript com `tsx`; mantenha as dependências de desenvolvimento instaladas neste preview.

## Primeiro uso

Na raiz do repositório:

```bash
npm ci
npm run demo  # opcional: cria um projeto com três repos fictícios
npm run dev
```

Abra **http://127.0.0.1:5173** e copie o código de pareamento exibido pelo runtime. O código fica em `.workbench/pairing-token` com permissão `0600`. Não o publique nem o coloque no Git.

Na demo:

1. Selecione o projeto **Migração Dataform → dbt**.
2. Alterne entre as abas dbt, Dataform e Airflow. Clique em **Iniciar terminal** em cada uma para abrir um shell real no diretório correspondente.
3. Clique em **Investigar**, selecione a sessão Airflow, descreva o objetivo e use `payments` como texto a localizar.
4. Expanda a tarefa concluída: o resultado contém arquivo, linha, trecho e revisão Git. A busca é literal e não usa LLM.
5. Em **Knowledge**, proponha uma regra com URL e trecho da evidência. Revise e valide explicitamente. O conhecimento validado aparece no contexto de todos os projetos.
6. Clique em **dbt** no repositório dbt para inspecionar o manifest da demo.
7. Reinicie o runtime: projetos, recursos, sessões, tarefas, evidências e eventos permanecem. Processos de terminal não são retomados; sessões em execução ficam `interrupted`.

A demo só cria dados quando não há projetos. Pare o runtime antes de executar esse comando. Ela cria seus próprios repositórios dentro de `.workbench` e não modifica repositórios externos.

## Build e verificação

```bash
npm test
npm run lint
npm run format:check
npm run build
npm start
```

Depois do build, a interface é servida pelo próprio runtime em **http://127.0.0.1:4317**, sem Vite. Não há fontes, scripts ou inferência remotos necessários à interface.

`WORKBENCH_HOME` altera a pasta de dados; use o mesmo caminho absoluto no runtime e no MCP. `WORKBENCH_PORT` altera a porta do runtime (padrão 4317). Em desenvolvimento, o proxy Vite usa 4317; ao mudar essa porta, ajuste `apps/web/vite.config.ts`. Mantenha bind em loopback.

## Conectar um cliente MCP

Inicie o runtime e configure seu cliente Claude Code/Codex com o equivalente a:

```json
{
  "mcpServers": {
    "workbench": {
      "command": "node",
      "args": [
        "--import",
        "/caminho/agentic-workbench/node_modules/tsx/dist/loader.mjs",
        "/caminho/agentic-workbench/packages/mcp-workbench/src/index.ts"
      ],
      "env": {
        "WORKBENCH_HOME": "/caminho/agentic-workbench/.workbench"
      }
    }
  }
}
```

Substitua os caminhos e adapte o formato à configuração oficial do cliente instalado. Alternativamente, execute `npm run mcp` com o diretório de trabalho definido como a raiz do repo. O MCP usa stdio e não imprime logs no stdout.

Ferramentas:

- `workbench.list_projects`, `workbench.list_workspaces`;
- `workbench.get_project_context`, `workbench.find_knowledge`;
- `workbench.request_task`, `workbench.get_task_status`, `workbench.get_task_result`;
- `workbench.register_evidence` (cria proposta, não valida conhecimento).

`request_task` precisa de `project_id`, `target_workspace_id`, `objective`, `query` e `idempotency_key`. Use os IDs retornados pelas ferramentas de listagem. O resultado é assíncrono e persistido. Um exemplo:

```json
{
  "project_id": "prj_...",
  "target_workspace_id": "ws_...",
  "objective": "Localizar DAGs de pagamentos",
  "query": "payments",
  "mode": "read_only",
  "idempotency_key": "investigacao-payments-1"
}
```

Reutilizar uma chave com outro conteúdo é rejeitado. Existem no máximo duas buscas simultâneas e uma por sessão destino. Tarefas não são reexecutadas automaticamente após reinício.

## Dados e permissões

SQLite é a fonte canônica, com WAL, eventos e transações locais. Este preview usa uma tabela de registros JSON tipados e vínculos projeto/recurso; ainda não aplica as tabelas normalizadas e projeções do plano completo.

O terminal é um shell real com as permissões do usuário. O modo `read_only` se aplica exclusivamente ao adaptador de investigação, que lê arquivos diretamente sem executar código ou comandos do conteúdo. Terminais interativos não são sandboxes e o Workbench não restringe os comandos digitados por você ou por um CLI iniciado explicitamente.

A busca ignora arquivos ocultos, symlinks e diretórios de dependências. Há limites de entradas, profundidade, arquivos e tamanho por arquivo; os resultados informam esses limites. Registre apenas diretórios cuja leitura você autoriza. Não use o preview para fontes de dados hostis sob modificação concorrente: a contenção por realpath não é um sandbox de sistema operacional.

Saída de PTY fica apenas em buffer volátil limitado, não em SQLite. O histórico persistido é de eventos do Workbench; trechos de evidências de tarefas permanecem no banco. Revise o conteúdo dos repositórios antes de investigar. Um terminal com Codex/Claude pode enviar contexto ao provedor conforme a configuração do CLI. Não há execução programática de LLM pelo coordenador neste preview.

Para backup neste estágio, pare o runtime e copie **toda** a pasta de dados (incluindo arquivos SQLite/WAL/SHM se presentes). Restaure com o serviço parado. Não use cópia de um SQLite em execução como backup consistente. Export/import e armazenamento de credenciais no keychain ainda estão pendentes.

## Troubleshooting

- `node-pty` não instala: confirme compilador, Python e headers para a versão de Node. Em ambientes com HOME somente leitura, use um cache e diretório de build graváveis, por exemplo `npm_config_devdir=/tmp/node-gyp npm ci --cache /tmp/npm-cache`.
- CLI não encontrado: instale `codex`/`claude`, ajuste o PATH do runtime e autentique o CLI fora do Workbench.
- `manifest.json` não encontrado: gere os artefatos dbt no repositório selecionado (`target/manifest.json`). A aplicação não executa dbt automaticamente.
- Pareamento inválido após reinício: atualize a página e use o código local. Cookies de sessão são renovados ao reiniciar o runtime. Para revogar também o código de MCP, pare o runtime e remova apenas `pairing-token`; o próximo início gera outro.
- Portas ocupadas: encerre a instância anterior. Vite usa porta fixa para não mudar silenciosamente a origem autorizada.
