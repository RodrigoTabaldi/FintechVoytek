# Infraestrutura

`../docker-compose.yml` monta PostgreSQL, Redis, RabbitMQ, duas instâncias Voytek.Api, Nginx como gateway/load balancer local e o worker. O Nginx está configurado em `nginx/voytek.conf`.

Esta configuração é um perfil de desenvolvimento, não um ambiente de alta disponibilidade: CDN/WAF, TLS público, cluster de banco, backups gerenciados, Kubernetes, secret manager e observabilidade central ainda exigem provisionamento da plataforma escolhida. Consulte `../docs/architecture/README.md` para o mapa de componentes e lacunas.
