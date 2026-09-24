# Voytek

Infraestrutura de governança financeira e operacional para agentes de IA. Empresas definem objetivos, orçamento, políticas e autonomia; a Voytek avalia cada solicitação de forma determinística e registra a decisão.

> O agente propõe. A Voytek autoriza. O executor só age dentro dos limites. O ledger registra; os outcomes medem; a auditoria explica.

## Escopo do MVP

O MVP prioriza identidade de agentes, objetivos, budgets lógicos, políticas, decisões `ALLOW` / `DENY` / `HUMAN_APPROVAL`, aprovações, Shadow Mode, ledger, outcomes e auditoria. A proposta de IA é consultiva: um modelo não é a autoridade final e a geração de proposta não executa tarefas.

Budgets e ledger são registros de controle, não uma conta com saldo custodiado pela Voytek. Pagamentos reais, Pix/Open Finance, cartões, cofre de credenciais/senhas, voz e marketplace são capacidades futuras; não são apresentados como integrações operacionais do MVP.

## Arquitetura

O projeto usa um monólito modular .NET com fronteiras de domínio e persistência PostgreSQL/EF Core. O React/TypeScript/Vite é o painel web. A imagem inicial propõe serviços e infraestrutura distribuídos; para o MVP, a topologia foi adaptada para módulos isolados dentro de um deploy simples, sem introduzir microserviços, Redis, broker externo ou Kubernetes antes de haver necessidade comprovada.

O diagrama, as fronteiras dos módulos e as extensões futuras estão em [`docs/architecture/README.md`](./docs/architecture/README.md). O contexto completo do produto e do MVP está em [`VOYTEK_AI_CONTEXT_MVP.txt`](./VOYTEK_AI_CONTEXT_MVP.txt); [`Ideia.txt`](./Ideia.txt) registra a visão inicial.

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
