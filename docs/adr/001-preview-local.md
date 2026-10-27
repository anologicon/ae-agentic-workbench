# ADR-001 — Primeiro incremento local executável

Status: aceito para o preview 0.1.0. Referência: decisões propostas ADR-001 a ADR-008 no plano original.

A interface é web em localhost, com React/Vite e runtime Node 24. Terminais são processos independentes das tarefas; reiniciar preserva metadados e interrompe processos. Conhecimento é independente do ciclo de vida dos projetos.

SQLite é a origem transacional e os registros são tipados e serializados em JSON, com tabela de vínculos e eventos. O esquema inicial tem versão 1. O runtime é o único escritor; o servidor MCP usa a API autenticada. DuckDB/Ladybug, migrações incrementais, outbox e projeções entram após os spikes respectivos. Nenhuma consistência entre três engines é presumida.

MCP é uma interface de ferramentas, não um scheduler. O coordenador limita tarefas e delegação; o worker inicial usa leitura direta e busca literal, não invoca modelos e não executa instruções dos arquivos. Isso permite validar o transporte e a persistência antes de enviar dados à nuvem.

Iniciar um terminal é uma ação explícita do usuário. O shell interativo não tem a garantia read-only do worker. CLI de provedor e delegação programática são mecanismos separados. Nenhum texto é digitado automaticamente em um terminal ocupado para delegar.

A validação de conhecimento requer cookie da interface local; credenciais bearer usadas pelo MCP não permitem essa transição. Captura Chrome, escrita Jira, worktrees automatizadas e inferência ficam indisponíveis até suas implementações e testes, com permissões específicas.

Consequências: preview usável sem credenciais externas e com zero inferência ociosa. O gate G0 completo e os gates G2/G3/G4 da V1 ainda não estão atendidos. Testes Linux não constituem validação de empacotamento macOS/Windows.
