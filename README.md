# Voytek

**Governance for AI agent operations: define limits, evaluate requests, and keep an auditable record.**

[English](#english) · [Português](#português)

[![.NET 8](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/) [![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/) [![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)

<p align="center">
  <img src="docs/images/dashboard.png" alt="Voytek dashboard showing agent operations and logical budget" width="100%">
</p>

<p align="center"><strong>Project status: In development · MVP</strong></p>

---

## English

### Overview

Voytek is a web application and .NET API for governing AI agent operations. Organizations can register agents, define objectives and logical budgets, configure policies, evaluate authorization requests, and review decisions and activity records.

**The agent proposes. Voytek evaluates and records. An external executor is outside this MVP.**

Logical budgets, the ledger, and Shadow Mode are governance records. They do not hold money, execute payments, or connect to financial rails.

### Problem it addresses

Autonomous agents can take actions with operational or financial consequences. Teams need a way to define boundaries and review requests before execution. Voytek provides a place to model those limits and record policy outcomes; it does not itself execute the proposed actions.

### Features

- Organization registration, sign-in, tenant selection, and role-based access.
- Agent lifecycle controls, including activation, suspension, disabling, and a kill switch.
- Objectives and logical budgets associated with agents.
- Policy evaluation with ALLOW, DENY, or HUMAN_APPROVAL outcomes.
- Human approval and Shadow Mode evaluation without external execution or budget reservation.
- Ledger, audit, and outcome records.
- Consultative agent proposals through an LLM provider interface; the configured provider can be disabled.
- SaaS subscription records and recommendations based on unused seats or upcoming renewals.
- API credentials that are shown at creation and stored as hashes.
- Health endpoints and request rate limiting.

The UI also shows future-facing areas. Voice transcription, payment execution, credential vaults, and agent commerce are not operational integrations in this MVP. Agent commerce is explicitly marked as planned.

### Screenshots

These are screenshots of the current application, not product mockups.

<table>
  <tr>
    <td width="50%"><img src="docs/images/dashboard.png" alt="Dashboard" width="100%"><br><strong>Dashboard</strong></td>
    <td width="50%"><img src="docs/images/agents.png" alt="Agent management" width="100%"><br><strong>Agent management</strong></td>
  </tr>
  <tr>
    <td><img src="docs/images/automation.png" alt="Automation and Shadow Mode evaluation" width="100%"><br><strong>Automation and authorization</strong></td>
    <td><img src="docs/images/budgets.png" alt="Logical budgets" width="100%"><br><strong>Logical budgets</strong></td>
  </tr>
  <tr>
    <td><img src="docs/images/shadow-mode.png" alt="Shadow Mode decisions" width="100%"><br><strong>Shadow Mode</strong></td>
    <td><img src="docs/images/login.png" alt="Voytek sign-up screen" width="100%"><br><strong>Login and sign-up</strong></td>
  </tr>
</table>

### Tech stack

| Area | Technologies and role |
| --- | --- |
| Backend | C# / .NET 8, ASP.NET Core Minimal APIs, ASP.NET Core Identity, JWT bearer authentication |
| Frontend | React 18, TypeScript 5.6, Vite 6, CSS |
| Database | PostgreSQL 16, Entity Framework Core 8, Npgsql, EF Core migrations |
| Infrastructure | Docker, Docker Compose, GitHub Actions; workflow files for GHCR image publishing and Azure Container Apps deployment |
| Tools | .NET SDK 8, Node.js/npm, Git |

### Architecture

The MVP uses a modular monolith: one ASP.NET Core API hosts the application modules, with PostgreSQL persistence. The React single-page application calls the versioned HTTP API. This keeps domain areas separated in code without requiring independently deployed services.

The local Compose setup adds an Nginx gateway/load balancer for two stateless API replicas, Redis for short-lived AI proposal caching, RabbitMQ for asynchronous proposal telemetry, and a worker consumer. See the [architecture notes](docs/architecture/README.md) for implemented components and remaining production infrastructure.

~~~mermaid
flowchart TB
    User[Organization users] --> Web[Web app<br/>React and TypeScript]
    Web --> API[Voytek API<br/>ASP.NET Core and .NET 8]
    Client[Agents and API clients] --> API
    API --> Modules[Domain modules<br/>Identity, agents, policies, budgets, approvals, audit]
    Modules --> DB[(PostgreSQL<br/>EF Core and Npgsql)]
    API -. Proposal generation only .-> LLM[Optional LLM provider]
~~~

An authorization request is evaluated against configured domain rules. Shadow Mode records the evaluation without reserving a logical budget. An allowed request outside Shadow Mode reserves logical budget; it still does not cause an external payment.

### Repository layout

~~~text
apps/
  backend/
    src/
      Voytek.Api/             HTTP API, identity, endpoint composition
      Voytek.Domain/          Domain entities and rules
      Voytek.Application/     Application contracts and ports
      Voytek.Infrastructure/  EF Core, PostgreSQL, migrations, adapters
      Voytek.Contracts/       Shared contracts
      Voytek.SharedKernel/    Shared tenant abstractions
      Voytek.Workers/         Worker host
    modules/                  Module boundary documentation
  frontend/
    src/app/                  Workspace shell and navigation
    src/features/             Feature-oriented React screens
    src/api.ts                API client
docs/                           Architecture, API, security, development guides
tests/backend/                  Unit, integration, and architecture test projects
infra/                          Infrastructure documentation
scripts/                        Helper scripts and documentation
docker-compose.yml              Local PostgreSQL and API services
.github/workflows/              CI, image publishing, deployment workflows
~~~

### Technical decisions

- **Modular monolith:** domain areas have code boundaries while sharing one API deployment and database in this MVP. This avoids adding distributed infrastructure before the project requires it.
- **EF Core with PostgreSQL:** migrations version the relational schema; EF Core query filters and tenant context support tenant-scoped data access.
- **Identity and JWT:** ASP.NET Core Identity manages user authentication; JWT bearer tokens carry identity and tenant/role claims for API authorization.
- **Deterministic authorization:** policy and budget decisions stay in application code. The optional LLM provider supports proposals, not final authorization.
- **Logical ledger and Shadow Mode:** these record governance decisions without suggesting that Voytek holds funds or executes real payments.
- **Disabled adapters:** notification and object storage adapters are explicitly disabled.

### Engineering Highlights

- Versioned REST API using ASP.NET Core Minimal APIs.
- Relational domain modeling, EF Core migrations, and PostgreSQL persistence.
- Tenant context and tenant-scoped query filters.
- Identity, JWT authentication, role-based endpoint authorization, and API credential hashing.
- Policy-based authorization decisions, idempotency handling, and request validation.
- Health checks and request rate limiting.
- React and TypeScript frontend integrated with the backend API.
- Docker Compose development setup and GitHub Actions workflows for build/test, container publishing, and deployment.

These are implementation areas present in the repository; their presence does not imply production deployment or complete test coverage.

### API

Base path: **/api/v1**. Most application routes require authentication and tenant context; write operations apply role checks where configured.

| Resource | Main routes |
| --- | --- |
| Authentication | POST /auth/register, POST /auth/login, POST /auth/select-tenant |
| Agents | GET/POST /agents, GET/PUT /agents/{id}, lifecycle and kill-switch actions, POST /agents/{id}/proposals |
| Objectives | GET/POST /objectives, GET/PUT /objectives/{id}, activate and complete actions |
| Budgets | GET/POST /budgets, GET /budgets/{id}, POST /budgets/{id}/close |
| Policies | GET/POST /policies, POST /policies/{id}/deactivate |
| Authorizations | POST /authorizations |
| Approvals | GET /approvals, POST /approvals/{id}/approve, POST /approvals/{id}/reject |
| Records | GET /shadow, GET /ledger, GET/POST /outcomes, GET /audit |
| SaaS management | GET/POST /saas-subscriptions, POST /saas-subscriptions/analyze |
| API credentials | GET /api-credentials, POST /api-credentials/{name}, POST /api-credentials/{id}/revoke |
| Health | GET /health/live, GET /health/ready |

### Database

PostgreSQL is accessed through EF Core and Npgsql. The schema is evolved through migrations under apps/backend/src/Voytek.Infrastructure/Persistence/Migrations.

Main persisted entities include:

- **Identity and tenancy:** application users, tenants, memberships, API credentials.
- **Agent operations:** agents, objectives, budgets, policies, authorization requests, approval requests, Shadow Mode actions.
- **Records:** ledger entries, audit events, outcome records.
- **SaaS management:** subscriptions and recommendations.

Monetary values in budgets and ledger entries are logical accounting values for authorization and audit; they are not customer funds held by Voytek.

### Run locally

#### Prerequisites

- .NET SDK 8
- Node.js and npm
- Docker Desktop with Docker Compose
- Git

#### Configuration

The API needs a PostgreSQL connection string and JWT issuer, audience, and signing key. Optional AI configuration uses OPENAI_API_KEY, AI__Provider, AI__Model, and AI__TimeoutSeconds. The frontend can use VITE_API_URL to point to the API.

The root .env.example lists the available backend settings. Keep local secrets in .env or environment variables; do not commit them. Compose requires a Jwt__SigningKey of at least 32 characters. Set a new random value for local development.

#### Start API and database

From the repository root in PowerShell:

~~~powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env and set Jwt__SigningKey to a unique random value of at least 32 characters.
docker compose up --build -d
~~~

The API is available at http://localhost:8080. Check http://localhost:8080/health/ready.

#### Start the frontend

In a second PowerShell terminal:

~~~powershell
Set-Location .\apps\frontend
$env:VITE_API_URL = 'http://localhost:8080'
npm ci
npm run dev
~~~

Open http://localhost:5173.

To stop the containers while preserving the database volume:

~~~powershell
docker compose down
~~~

For backend build and test commands, and running the API without Compose, see [docs/development/README.md](docs/development/README.md). Test projects exist, but the current documentation reports no discovered business tests; check the CI workflow for the repository's configured commands.

### Challenges & learnings

The repository documents a deliberate MVP trade-off: preserve clear domain boundaries in a modular monolith and defer distributed services until there is a concrete need. It also separates authorization from execution: Shadow Mode allows evaluation and audit before any future executor exists.

### Roadmap and project status

**Implemented foundations in the current codebase:** tenant-aware identity, agents and objectives, logical budgets, policies and authorization, approvals, Shadow Mode, ledger/audit/outcome records, SaaS subscription review, API health checks, and the web workspace.

**Future work / not operational in this MVP:** voice transcription, payment and card integrations, credential vault, external task executors, and agent-to-agent commerce. The commerce screen is marked planned; notifications and object storage use disabled adapters.

**Status: In development.** The repository includes application code, migrations, screenshots, test projects, and CI/deployment workflow definitions. Workflow definitions do not by themselves confirm that external cloud resources are configured or that the application is deployed.

### Project documentation

- [Architecture](docs/architecture/README.md)
- [API reference](docs/api/README.md)
- [Database notes](docs/database/README.md)
- [Development guide](docs/development/README.md)
- [Security notes](docs/security/README.md)
- [Deployment notes](docs/deployment/README.md)

### Author

**Rodrigo Tabaldi**

Software Engineering student focused on Backend Development, .NET and Full Stack applications.

[GitHub](https://github.com/RodrigoTabaldi)

---

## Português

### Visão geral

Voytek é uma aplicação web e uma API .NET para governar operações de agentes de IA. Organizações podem cadastrar agentes, definir objetivos e budgets lógicos, configurar políticas, avaliar solicitações de autorização e consultar decisões e registros de atividade.

**O agente propõe. A Voytek avalia e registra. Um executor externo está fora deste MVP.**

Valores registrados não são dinheiro sob custódia da Voytek nem pagamentos executados por ela.

### Problema que resolve

Agentes autônomos podem realizar ações com consequências operacionais ou financeiras. Equipes precisam definir limites e revisar solicitações antes da execução. A Voytek oferece um lugar para modelar esses limites e registrar os resultados das políticas; ela não executa as ações propostas.

### Funcionalidades

- Cadastro de organização, login, seleção de tenant e acesso por papéis.
- Controles do ciclo de vida do agente: ativação, suspensão, desativação e kill switch.
- Objetivos e budgets lógicos associados a agentes.
- Avaliação de políticas com resultados ALLOW, DENY ou HUMAN_APPROVAL.
- Aprovação humana e avaliação em Shadow Mode sem execução externa nem reserva de budget.
- Registros de ledger, auditoria e outcomes.
- Propostas consultivas de agentes por uma interface de provedor LLM; o provedor configurado pode ser desativado.
- Cadastro de assinaturas SaaS e recomendações baseadas em assentos sem uso ou renovações próximas.
- Credenciais de API exibidas na criação e armazenadas como hashes.
- Endpoints de saúde e limitação de taxa de requisições.

A interface também apresenta áreas futuras. Transcrição por voz, execução de pagamentos, cofre de credenciais e agent commerce não são integrações operacionais neste MVP. A tela de agent commerce está explicitamente marcada como planejada.

### Screenshots

Estas imagens mostram a aplicação atual, não protótipos.

<table>
  <tr>
    <td width="50%"><img src="docs/images/dashboard.png" alt="Painel geral" width="100%"><br><strong>Painel geral</strong></td>
    <td width="50%"><img src="docs/images/agents.png" alt="Gestão de agentes" width="100%"><br><strong>Gestão de agentes</strong></td>
  </tr>
  <tr>
    <td><img src="docs/images/automation.png" alt="Automações e avaliação em Shadow Mode" width="100%"><br><strong>Automações e autorizações</strong></td>
    <td><img src="docs/images/budgets.png" alt="Budgets lógicos" width="100%"><br><strong>Budgets lógicos</strong></td>
  </tr>
  <tr>
    <td><img src="docs/images/shadow-mode.png" alt="Decisões em Shadow Mode" width="100%"><br><strong>Shadow Mode</strong></td>
    <td><img src="docs/images/login.png" alt="Tela de login e cadastro da Voytek" width="100%"><br><strong>Login e cadastro</strong></td>
  </tr>
</table>

### Tecnologias

| Área | Tecnologias e função |
| --- | --- |
| Backend | C# / .NET 8, ASP.NET Core Minimal APIs, ASP.NET Core Identity, autenticação JWT bearer |
| Frontend | React 18, TypeScript 5.6, Vite 6, CSS |
| Banco de dados | PostgreSQL 16, Entity Framework Core 8, Npgsql, migrations do EF Core |
| Infraestrutura | Docker, Docker Compose, GitHub Actions; workflows para publicar imagem no GHCR e fazer deploy no Azure Container Apps |
| Ferramentas | .NET SDK 8, Node.js/npm, Git |

### Arquitetura

O MVP usa um monólito modular: uma API ASP.NET Core hospeda os módulos da aplicação e persiste os dados no PostgreSQL. O aplicativo React de página única consome a API HTTP versionada. Assim, as áreas de domínio têm limites no código sem exigir serviços implantados de forma independente.

A execução local com Docker Compose inclui Nginx como gateway/load balancer para duas réplicas stateless da API, Redis para cache curto de propostas de IA, RabbitMQ para telemetria assíncrona de propostas e um worker consumidor. O estado implementado, as diferenças para a arquitetura inicial e as etapas restantes estão em [`docs/architecture/README.md`](./docs/architecture/README.md). [`Ideia.txt`](./Ideia.txt) registra a visão inicial do produto.

~~~mermaid
flowchart TB
    User[Usuarios da organizacao] --> Web[Painel web<br/>React e TypeScript]
    Web --> API[API Voytek<br/>ASP.NET Core e .NET 8]
    Client[Agentes e clientes de API] --> API
    API --> Modules[Modulos de dominio<br/>Identidade, agentes, politicas, budgets, aprovacoes, auditoria]
    Modules --> DB[(PostgreSQL<br/>EF Core e Npgsql)]
    API -. Somente geracao de propostas .-> LLM[Provedor LLM opcional]
~~~

Uma solicitação de autorização é avaliada pelas regras de domínio configuradas. Shadow Mode registra a avaliação sem reservar budget lógico. Uma solicitação permitida fora do Shadow Mode reserva budget lógico, mas ainda não realiza pagamento externo.

### Estrutura do repositório

~~~text
apps/
  backend/
    src/
      Voytek.Api/             API HTTP, identidade e composição de endpoints
      Voytek.Domain/          Entidades e regras de domínio
      Voytek.Application/     Contratos e portas da aplicação
      Voytek.Infrastructure/  EF Core, PostgreSQL, migrations e adaptadores
      Voytek.Contracts/       Contratos compartilhados
      Voytek.SharedKernel/    Abstrações compartilhadas de tenant
      Voytek.Workers/         Host para workers
    modules/                  Documentação das fronteiras dos módulos
  frontend/
    src/app/                  Estrutura principal e navegação
    src/features/             Telas React organizadas por funcionalidade
    src/api.ts                Cliente da API
docs/                           Guias de arquitetura, API, segurança e desenvolvimento
tests/backend/                  Projetos de testes unitários, integração e arquitetura
infra/                          Documentação de infraestrutura
scripts/                        Scripts auxiliares e documentação
docker-compose.yml              PostgreSQL e API locais
.github/workflows/              CI, publicação da imagem e workflows de deploy
~~~

### Decisões técnicas

- **Monólito modular:** áreas de domínio têm limites no código e compartilham uma implantação de API e um banco neste MVP. Isso evita adicionar infraestrutura distribuída antes de haver necessidade.
- **EF Core com PostgreSQL:** migrations versionam o schema relacional, e filtros de consulta do EF Core junto ao contexto de tenant dão suporte ao acesso por organização.
- **Identity e JWT:** ASP.NET Core Identity gerencia autenticação de usuários; tokens JWT carregam identidade e claims de tenant/papel usados na autorização da API.
- **Autorização determinística:** decisões de política e budget ficam no código da aplicação. O provedor LLM opcional apoia propostas, não a autorização final.
- **Ledger lógico e Shadow Mode:** registram decisões de governança sem sugerir que a Voytek custodia fundos ou executa pagamentos reais.
- **Adaptadores desativados:** notificações e armazenamento de objetos estão explicitamente desativados.

### Destaques de engenharia

- API REST versionada com ASP.NET Core Minimal APIs.
- Modelagem relacional, migrations do EF Core e persistência PostgreSQL.
- Contexto de tenant e filtros de consulta para dados associados à organização.
- Identity, autenticação JWT, autorização por papéis e hash de credenciais de API.
- Decisões de autorização por políticas, idempotência e validação de solicitações.
- Health checks e limitação de taxa de requisições.
- Frontend React/TypeScript integrado à API backend.
- Ambiente local com Docker Compose e workflows GitHub Actions para build/testes, publicação de contêiner e deploy.

Essas áreas estão presentes no repositório; isso não significa que o sistema esteja implantado em produção ou tenha cobertura completa de testes.

### API

Prefixo base: **/api/v1**. A maioria das rotas da aplicação exige autenticação e contexto de tenant; operações de escrita aplicam verificações de papel onde configuradas.

| Recurso | Rotas principais |
| --- | --- |
| Autenticação | POST /auth/register, POST /auth/login, POST /auth/select-tenant |
| Agentes | GET/POST /agents, GET/PUT /agents/{id}, ações de ciclo de vida e kill switch, POST /agents/{id}/proposals |
| Objetivos | GET/POST /objectives, GET/PUT /objectives/{id}, ações de ativar e concluir |
| Budgets | GET/POST /budgets, GET /budgets/{id}, POST /budgets/{id}/close |
| Políticas | GET/POST /policies, POST /policies/{id}/deactivate |
| Autorizações | POST /authorizations |
| Aprovações | GET /approvals, POST /approvals/{id}/approve, POST /approvals/{id}/reject |
| Registros | GET /shadow, GET /ledger, GET/POST /outcomes, GET /audit |
| Gestão SaaS | GET/POST /saas-subscriptions, POST /saas-subscriptions/analyze |
| Credenciais de API | GET /api-credentials, POST /api-credentials/{name}, POST /api-credentials/{id}/revoke |
| Saúde | GET /health/live, GET /health/ready |

### Banco de dados

O PostgreSQL é acessado por meio do EF Core e Npgsql. O schema evolui por migrations em apps/backend/src/Voytek.Infrastructure/Persistence/Migrations.

As principais entidades persistidas incluem:

- **Identidade e tenancy:** usuários da aplicação, tenants, memberships e credenciais de API.
- **Operação de agentes:** agentes, objetivos, budgets, políticas, solicitações de autorização, aprovações e ações em Shadow Mode.
- **Registros:** lançamentos de ledger, eventos de auditoria e registros de outcomes.
- **Gestão SaaS:** assinaturas e recomendações.

Valores monetários em budgets e ledger são registros lógicos de autorização e auditoria; não representam dinheiro de clientes sob custódia da Voytek.

### Executar localmente

#### Pré-requisitos

- .NET SDK 8
- Node.js e npm
- Docker Desktop com Docker Compose
- Git

#### Configuração

A API precisa de uma connection string PostgreSQL e de issuer, audience e signing key do JWT. A configuração opcional de IA usa OPENAI_API_KEY, AI__Provider, AI__Model e AI__TimeoutSeconds. O frontend pode usar VITE_API_URL para apontar para a API.

O arquivo .env.example na raiz lista as configurações disponíveis para o backend. Mantenha segredos locais em .env ou em variáveis de ambiente; não os envie ao Git. O Compose exige um Jwt__SigningKey com pelo menos 32 caracteres. Defina um novo valor aleatório para o ambiente local.

#### Iniciar API e banco

Na raiz do repositório, usando PowerShell:

~~~powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edite .env e configure Jwt__SigningKey com um valor aleatório exclusivo de pelo menos 32 caracteres.
docker compose up --build -d
~~~

A API ficará disponível em http://localhost:8080. Verifique http://localhost:8080/health/ready.

#### Iniciar o frontend

Em outro terminal PowerShell:

~~~powershell
Set-Location .\apps\frontend
$env:VITE_API_URL = 'http://localhost:8080'
npm ci
npm run dev
~~~

Abra http://localhost:5173.

Para parar os containers mantendo o volume do banco:

~~~powershell
docker compose down
~~~

Os comandos de build e teste do backend e a execução da API sem Compose estão em [docs/development/README.md](docs/development/README.md). Há projetos de teste no repositório, mas a documentação atual informa que nenhum teste de negócio é descoberto; consulte o workflow de CI para os comandos configurados.

### Desafios e aprendizados

O repositório documenta uma escolha deliberada para o MVP: manter limites de domínio claros em um monólito modular e adiar serviços distribuídos até que exista uma necessidade concreta. Também separa autorização de execução: o Shadow Mode permite avaliar e auditar solicitações antes de existir um executor futuro.

### Roadmap e status do projeto

**Fundamentos implementados no código atual:** identidade com tenant, agentes e objetivos, budgets lógicos, políticas e autorizações, aprovações, Shadow Mode, registros de ledger/auditoria/outcomes, revisão de assinaturas SaaS, health checks da API e painel web.

**Trabalho futuro / não operacional neste MVP:** transcrição por voz, integrações de pagamentos e cartões, cofre de credenciais, executores de tarefas externas e comércio entre agentes. A tela de comércio está marcada como planejada; notificações e armazenamento de objetos usam adaptadores desativados.

**Status: Em desenvolvimento.** O repositório inclui código da aplicação, migrations, screenshots, projetos de teste e definições de workflows de CI/deploy. A existência de workflows não confirma, por si só, que recursos externos de nuvem estão configurados ou que a aplicação está implantada.

### Documentação do projeto

- [Arquitetura](docs/architecture/README.md)
- [Referência da API](docs/api/README.md)
- [Notas do banco de dados](docs/database/README.md)
- [Guia de desenvolvimento](docs/development/README.md)
- [Notas de segurança](docs/security/README.md)
- [Notas de deploy](docs/deployment/README.md)

### Autor

**Rodrigo Tabaldi**

Estudante de Engenharia de Software com foco em desenvolvimento Backend, .NET e aplicações Full Stack.

[GitHub](https://github.com/RodrigoTabaldi)
