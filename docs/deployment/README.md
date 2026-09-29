# Deploy e operação

## Perfil local com Compose

Na raiz do repositório, crie `.env` a partir de `.env.example`, substitua a chave JWT e credenciais locais, e inicie:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

O Nginx expõe `http://localhost:8080` e distribui tráfego entre `api-1` e `api-2`. PostgreSQL, Redis e RabbitMQ ficam na rede interna do Compose, exceto a porta `5432` do PostgreSQL, mantida para desenvolvimento local. O serviço `worker` consome telemetria de propostas geradas.

Esse perfil não configura TLS, CDN, WAF, failover de banco ou autoscaling. Os valores padrão do Compose são somente para desenvolvimento. Não reutilize `.env.example` em ambientes compartilhados e não publique as portas internas de Redis/RabbitMQ.

## Azure

O workflow em `.github/workflows/azure-container-apps.yml` é um ponto de partida para deploy da API; ele não provisiona sozinho o gateway, réplicas da API, worker, broker, Redis, storage, banco com failover, observabilidade ou secrets do desenho completo. Antes do deploy, configure os secrets exigidos por [`azure-container-apps.md`](./azure-container-apps.md) e adapte os recursos, probes, escala e conexões ao ambiente escolhido.

Para produção, use identidade gerenciada quando suportada, secret manager da plataforma, rede privada, TLS e limites por serviço. Não reutilize credenciais locais nem registre chaves de provedor em logs.
