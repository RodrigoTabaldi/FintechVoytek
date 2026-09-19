# Voytek

## Infraestrutura de controle para agentes de IA

A Voytek será uma plataforma SaaS de infraestrutura financeira, operacional e de governança para agentes de inteligência artificial.

Em termos simples:

> A empresa define o que um agente pode fazer, quanto pode gastar e quando precisa de aprovação. A Voytek verifica essas regras antes de permitir uma ação.

## O problema

Agentes de IA conseguem analisar informações, planejar tarefas e utilizar ferramentas. Porém, quando passam a acessar sistemas, consumir APIs pagas, contratar serviços ou tomar decisões com impacto financeiro, a empresa precisa manter controle sobre:

- quem é o agente;
- qual objetivo ele deve alcançar;
- qual orçamento está disponível;
- quais fornecedores, categorias e ações são permitidos;
- qual nível de autonomia foi concedido;
- quando uma pessoa precisa aprovar a ação;
- qual foi a decisão, o motivo e o resultado.

A Voytek existe para fornecer essa camada de controle.

## Como a Voytek funciona

O fluxo principal será:

```text
Agente ou LLM
    ↓ propõe uma ação
Voytek recebe a solicitação
    ↓ verifica identidade, objetivo, budget e policies
Policy Engine
    ↓
ALLOW / DENY / HUMAN_APPROVAL
    ↓
Execução real ou Shadow Mode
    ↓
Ledger → Outcome → Audit
```

O agente pode sugerir uma ação, mas não pode autorizar a si próprio. O LLM pode interpretar contexto e preparar uma proposta; a decisão final deve ser aplicada por regras determinísticas da Voytek.

## Exemplo

Uma empresa pode criar um agente para cuidar do estoque de EPIs e definir:

- objetivo: manter estoque suficiente para 100 funcionários;
- budget: R$ 8.000 por mês;
- fornecedores autorizados;
- limite de R$ 2.000 por compra sem aprovação;
- aprovação humana para valores superiores;
- categoria permitida: EPI.

Quando o agente identificar uma necessidade, ele enviará uma proposta. A Voytek verificará as regras e retornará `ALLOW`, `DENY` ou `HUMAN_APPROVAL`, sempre registrando o motivo da decisão.

## Conceitos principais

- **Tenancy:** cada empresa possui seu próprio espaço e seus dados não podem ser acessados por outra empresa.
- **Agent:** identidade operacional do agente dentro da Voytek.
- **Objective:** resultado que o agente deve buscar.
- **Budget:** orçamento lógico associado a um agente ou objetivo; não representa dinheiro custodiado pela Voytek.
- **Policy:** regras que limitam ações, valores, fornecedores, categorias e condições.
- **Autonomy:** nível de autonomia concedido ao agente: manual, supervisionado ou autônomo.
- **Approval:** intervenção humana quando uma ação exige autorização.
- **Shadow Mode:** simulação de ações sem execução real.
- **Ledger:** registro econômico e operacional das movimentações.
- **Outcome:** resultado alcançado pelo agente em relação ao objetivo.
- **Audit:** histórico explicável de eventos, decisões e responsáveis.

## Visão do MVP futuro

O MVP deverá permitir que uma empresa:

1. crie sua organização e usuários;
2. crie agentes com identidade e nível de autonomia;
3. defina objetivos, budgets e policies;
4. envie solicitações de autorização;
5. receba decisões `ALLOW`, `DENY` ou `HUMAN_APPROVAL`;
6. teste ações em Shadow Mode;
7. acompanhe Ledger, Outcomes e Audit;
8. suspenda um agente por meio de um Kill Switch;
9. acompanhe tudo por dashboard e API.

O MVP não pressupõe que a Voytek custodie dinheiro real. O foco inicial é controlar intenção, autorização, execução simulada, rastreabilidade e resultado.

## Arquitetura

O projeto começa como um **Modular Monolith**, organizado com Clean Architecture e conceitos de DDD. Essa escolha mantém o desenvolvimento e o deploy simples, preservando fronteiras claras para uma futura extração de módulos como Policies, Ledger, AI ou Commerce.

Módulos previstos:

`Identity`, `Tenancy`, `Agents`, `Objectives`, `Budgets`, `Policies`, `Approvals`, `ShadowMode`, `Ledger`, `Outcomes`, `Commerce`, `AI`, `Notifications` e `Audit`.

Tecnologias planejadas:

- backend: C#, ASP.NET Core e .NET;
- frontend: React, TypeScript e Vite;
- persistência futura: PostgreSQL e Entity Framework Core;
- cloud futura: Microsoft Azure e Azure Container Apps;
- containers: Docker.

## Estado atual do repositório

Neste momento, o repositório contém somente a estrutura arquitetural inicial: solution .NET, projetos separados, fronteiras dos módulos, estrutura frontend por features, áreas de testes, documentação e infraestrutura.

Ainda não foram implementados casos de uso, endpoints funcionais, entidades, regras financeiras, banco de dados, migrations, autenticação ou integrações externas.

Consulte [`VOYTEK_AI_CONTEXT_MVP.txt`](./VOYTEK_AI_CONTEXT_MVP.txt) para o contexto completo do produto e do MVP.
