# API HTTP

Prefixo atual: `/api/v1`. Endpoints protegidos exigem autenticação e contexto de tenant; operações administrativas aplicam papéis no backend.

## Recursos presentes no código

| Recurso | Rotas principais |
| --- | --- |
| Autenticação | `POST /auth/register`, `POST /auth/login`, `POST /auth/select-tenant` |
| Agentes | `GET/POST /agents`, `GET/PUT /agents/{id}`, `POST /agents/{id}/activate`, `/suspend`, `/disable`, `/kill-switch/activate`, `/kill-switch/deactivate`, `/proposals` |
| Objetivos | `GET/POST /objectives`, `GET/PUT /objectives/{id}`, `/activate`, `/complete` |
| Budgets | `GET/POST /budgets`, `GET /budgets/{id}`, `POST /budgets/{id}/close` |
| Políticas | `GET/POST /policies`, `POST /policies/{id}/deactivate` |
| Autorização e revisão | `POST /authorizations`, `GET /approvals`, `POST /approvals/{id}/approve`, `/reject` |
| Registros | `GET /shadow`, `GET /ledger`, `GET /outcomes`, `POST /outcomes`, `GET /audit` |
| Operação de SaaS | `GET/POST /saas-subscriptions`, `POST /saas-subscriptions/analyze` |
| Credenciais de API | `GET /api-credentials`, `POST /api-credentials/{name}`, `POST /api-credentials/{id}/revoke` |
| Saúde | `GET /health/live`, `GET /health/ready` |

As rotas descritas foram conferidas em `Voytek.Api/Program.cs`; a tabela não substitui OpenAPI/contratos detalhados. A autorização efetiva deve ser determinada pela API, nunca por controles de interface.

## Decisões de autorização

`POST /authorizations` valida valor positivo (máximo duas casas decimais), moeda de três letras, tipo, finalidade e chave de idempotência. A mesma chave só pode repetir uma solicitação com payload equivalente; reutilizá-la com payload diferente resulta em conflito.

Em Shadow Mode, a política é avaliada e o resultado é registrado sem reservar budget. Fora desse modo, uma decisão `ALLOW` reserva o valor lógico; `HUMAN_APPROVAL` aguarda decisão de usuário autorizado. Nenhuma resposta `ALLOW` significa que um pagamento externo foi concluído.

O endpoint de proposta do agente é consultivo e não executa a proposta. Capacidades reais de pagamento, cartões, voz, cofre de credenciais e conectores de execução permanecem fora do MVP.

Quando o provedor está habilitado, `POST /agents/{agentId}/proposals` recupera contexto lexical do agente, de seus objetivos ativos e de suas políticas ativas, sempre sob o filtro do tenant autenticado. O texto gerado continua sujeito às mesmas regras determinísticas de autorização; não é uma decisão. A resposta inclui `cached: true` se veio do cache Redis/memória. O cache tem TTL curto e nunca é usado para decisões, budget ou ledger.

Esse endpoint limita cinco propostas por minuto por identidade/tenant. No Compose, Redis compartilha a cota entre réplicas; sem Redis, cada processo aplica seu próprio limite.

Em Compose, a API publica metadados de geração no RabbitMQ; prompts e respostas não entram na mensagem. O worker consome essa telemetria e a registra. A publicação é best-effort e não faz parte de uma transação/outbox de negócio.
