# Desenvolvimento local

Pré-requisitos: .NET 8 SDK, Node.js/npm e Docker Compose para a topologia em containers.

## API e infraestrutura via Compose

Na raiz do repositório, crie `.env` sem sobrescrever um arquivo existente. Se já houver `.env`, acrescente manualmente as chaves novas que estiverem faltando (`POSTGRES_PASSWORD`, `REDIS_PASSWORD` e `RABBITMQ_PASSWORD`). Substitua a chave JWT por um valor aleatório de pelo menos 32 caracteres:

```powershell
if (Test-Path .env) { throw 'Preserve your existing .env and edit it manually.' }
Copy-Item .env.example .env
docker compose up --build -d
```

O Nginx publica `http://localhost:8080` e distribui requisições entre duas réplicas da API. PostgreSQL, Redis, RabbitMQ e worker iniciam junto. As APIs aplicam migrations sob um advisory lock PostgreSQL. Verifique `http://localhost:8080/health/ready` antes de usar o painel.

## Painel web

Em outro terminal PowerShell:

```powershell
Set-Location .\apps\frontend
$env:VITE_API_URL = 'http://localhost:8080'
npm.cmd ci
npm.cmd run dev
```

Abra `http://localhost:5173`. A origem local está na allowlist CORS da API.

## API sem containers

Com PostgreSQL disponível em `localhost:5432` e `.env` configurado, execute a partir da raiz:

```powershell
dotnet run --project .\apps\backend\src\Voytek.Api\Voytek.Api.csproj --launch-profile Voytek.Api
```

O perfil serve HTTP em `http://localhost:54309` e HTTPS em `https://localhost:54308`. Defina `$env:VITE_API_URL = 'http://localhost:54309'` no terminal do Vite. Redis e RabbitMQ são opcionais neste modo: sem Redis, o cache usa memória local; sem RabbitMQ, a telemetria de propostas fica desativada.

## Verificações

```powershell
dotnet build .\apps\backend\Voytek.sln -v:minimal
dotnet test .\apps\backend\Voytek.sln --no-build -v:minimal
```

Para compilar o frontend, execute `npm.cmd run build` em `apps\frontend`. Os projetos de teste existem, mas atualmente não descobrem casos de teste; build verde não representa cobertura automatizada dos fluxos de negócio.

Pare os serviços Compose sem apagar os dados persistidos:

```powershell
docker compose down
```
