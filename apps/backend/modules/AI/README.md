# AI

O adaptador OpenAI produz propostas consultivas. Antes da chamada, o retriever lexical seleciona contexto do agente, de seus objetivos ativos e de suas políticas ativas no tenant autenticado. Solicitações idênticas podem reutilizar uma proposta por um TTL curto no Redis. O LLM não autoriza, não reserva budget e não executa ações.
