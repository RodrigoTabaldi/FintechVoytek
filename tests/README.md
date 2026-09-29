# Testes

Os testes unitários estão em `backend/Voytek.UnitTests`. Atualmente, cobrem a separação por tenant/contexto do cache de propostas, a desativação do cache e a continuidade do fluxo quando o cache falha.

Os projetos `Voytek.IntegrationTests` e `Voytek.ArchitectureTests` ainda não contêm casos descobertos. Testes de Compose e integrações locais com PostgreSQL/Redis/RabbitMQ precisam ser executados quando Docker estiver disponível.
