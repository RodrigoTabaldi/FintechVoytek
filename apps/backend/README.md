# Backend

Solution .NET do monólito modular Voytek. Os projetos em `src` implementam API, domínio, aplicação, infraestrutura e worker. `modules` documenta fronteiras de negócio; elas ainda não são serviços .NET independentes. O worker consome eventos de telemetria de propostas via RabbitMQ.
