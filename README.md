# Voytek

Infraestrutura de governança financeira e operacional para agentes de IA. Empresas definem objetivos, orçamento, políticas e autonomia; a Voytek avalia cada solicitação de forma determinística e registra a decisão.

> O agente propõe. A Voytek autoriza. O executor só age dentro dos limites. O ledger registra; os outcomes medem; a auditoria explica.

## Escopo do MVP

O MVP prioriza identidade de agentes, objetivos, budgets lógicos, políticas, decisões `ALLOW` / `DENY` / `HUMAN_APPROVAL`, aprovações, Shadow Mode, ledger, outcomes e auditoria. A proposta de IA é consultiva: um modelo não é a autoridade final e a geração de proposta não executa tarefas.

Budgets e ledger são registros de controle, não uma conta com saldo custodiado pela Voytek. Pagamentos reais, Pix/Open Finance, cartões, cofre de credenciais/senhas, voz e marketplace são capacidades futuras; não são apresentados como integrações operacionais do MVP.

## Arquitetura

O backend continua como monólito modular .NET, com fronteiras de domínio e PostgreSQL/EF Core. A execução local agora inclui Nginx como gateway/load balancer para duas réplicas stateless da API, Redis para cache curto de propostas de IA, RabbitMQ para telemetria assíncrona de propostas e um worker consumidor. O painel continua em React/TypeScript/Vite e pode rodar em `apps/frontend`.

O estado implementado, as diferenças para a imagem e as etapas externas restantes estão em [`docs/architecture/README.md`](./docs/architecture/README.md). [`Ideia.txt`](./Ideia.txt) registra a visão inicial do produto.

## Código no repositório

- `apps/backend/src/Voytek.Api`: endpoints HTTP e autenticação.
- `apps/backend/src/Voytek.Domain`: entidades, estados e regras de domínio.
- `apps/backend/src/Voytek.Application`: casos de uso e contratos de aplicação.
- `apps/backend/src/Voytek.Infrastructure`: persistência, migrações e adaptadores.
- `apps/frontend`: painel React e TypeScript.
- `tests/backend`: projetos de testes .NET.

A interface apresenta dados retornados pela API e não cria métricas ou registros fictícios. A API deve ser considerada a autoridade final para isolamento de tenant e autorização por papel; esconder controles na interface não substitui essas validações.

## Desenvolvimento

Veja [`docs/development/README.md`](./docs/development/README.md) para comandos locais, e [`docs/api/README.md`](./docs/api/README.md) para a superfície HTTP.
