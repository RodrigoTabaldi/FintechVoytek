# Desenvolvimento local

Pré-requisitos: .NET 8 SDK, Node.js/npm e Docker Compose se for usar PostgreSQL em container.

## API e banco via Compose

Na raiz do repositório, crie um `.env` local e configure um segredo de JWT aleatório com pelo menos 32 caracteres. O `.env` é ignorado pelo Git; não use os valores de desenvolvimento em ambientes compartilhados.

```powershell
if (Test-Path .env) { throw 'Preserve your existing .env and edit it manually.' }
Copy-Item .env.example .env
# Edite .env e substitua Jwt__SigningKey por um segredo local aleatório.
docker compose up --build -d
```

A API publica `http://localhost:8080` e aplica as migrations ao iniciar. Verifique `http://localhost:8080/health/ready` antes de usar o painel.

## Painel web

Em outro terminal PowerShell:

```powershell
Set-Location .\apps\frontend
$env:VITE_API_URL = 'http://localhost:8080'
npm.cmd ci
npm.cmd run dev
```

Abra `http://localhost:5173`. A origem local está na allowlist CORS atual da API.

## API local sem container

Com PostgreSQL disponível em `localhost:5432` e o `.env` preenchido, a partir da raiz:

```powershell
dotnet run --project .\apps\backend\src\Voytek.Api\Voytek.Api.csproj --launch-profile Voytek.Api
```

O perfil publica HTTP em `http://localhost:54309` e HTTPS em `https://localhost:54308`. Para apontar o frontend a essa API, use `$env:VITE_API_URL = 'http://localhost:54309'` no terminal do Vite.

## Verificações

```powershell
dotnet build .\apps\backend\Voytek.sln -v:minimal
dotnet test .\apps\backend\Voytek.sln --no-build -v:minimal
```

O frontend usa `npm.cmd run build` dentro de `apps\frontend`. Os projetos de teste estão no repositório, mas no estado atual nenhum caso de teste é descoberto pelo `dotnet test`; build verde não equivale a cobertura automatizada.

Para parar os serviços sem apagar os dados persistidos:

```powershell
docker compose down
```
