# TD2 Builder - Runbook Operacional

Guia rápido para operação diária, manutenção e recuperação.

## 0) Comandos copy/paste por ambiente
### DEV local (API 3001 + Web 5173)
```bash
cd /var/www/td2-builder
docker compose up -d
npm install
cd apps/api && npx prisma migrate dev && npx prisma generate && cd ../..
npm run dev:api
```
Em outro terminal:
```bash
cd /var/www/td2-builder
npm run dev:web
```

### LAN (acesso de outro dispositivo na rede)
Pré-requisito:
- `apps/web/.env`: `VITE_API_URL=http://SEU_IP:3001/api`
- `apps/api/.env`: `CORS_ORIGIN=http://SEU_IP:5173,...`

Subida:
```bash
cd /var/www/td2-builder
docker compose up -d
npm run dev:api
```
Em outro terminal:
```bash
cd /var/www/td2-builder
npm run dev:web
```

### PROD (domínio + HTTPS com Caddy)
Pré-requisito:
- DNS do domínio apontando para o servidor.
- `infra/Caddyfile` com domínio correto.
- `apps/api/.env` com:
  - `COOKIE_SECURE=true`
  - `TRUST_PROXY=true`
  - `ENABLE_HSTS=true`
  - `CORS_ORIGIN=https://SEU_DOMINIO`
  - `JWT_SECRET` forte

Nota:
- `TRUST_PROXY=true` é importante para a API confiar em `X-Forwarded-For` (IP real do cliente) e manter rate-limit/auditoria corretos quando estiver atrás de Caddy/Nginx.

Deploy:
```bash
cd /var/www/td2-builder
npm install
cd apps/api && npx prisma migrate deploy && npx prisma generate && cd ../..
npm -w apps/web run build
docker compose -f docker-compose.prod.yml up -d
npm run start:api:prod
```

## 1) Subida rápida (dev)
No diretório raiz do projeto:

```bash
docker compose up -d
npm install
cd apps/api && npx prisma migrate dev && npx prisma generate && cd ../..
npm run dev:api
```

Em outro terminal:

```bash
npm run dev:web
```

Checks:
- Web: `http://localhost:5173`
- API: `http://localhost:3001/api/health`

## 2) Parada
Parar app (Ctrl+C nos processos `dev:api` e `dev:web`) e:

```bash
docker compose down
```

## 3) Operação diária (rotina recomendada)
1. `git pull` (se aplicável)
2. `npm install` (se lockfile mudou)
3. `cd apps/api && npx prisma migrate dev && npx prisma generate && cd ../..`
4. `npm run lint`
5. `npm run dev:api` e `npm run dev:web`

## 4) Banco de dados
### Backup
```bash
npm run db:backup
```

### Migrations pendentes
```bash
cd apps/api
npx prisma migrate status
npx prisma migrate dev
npx prisma generate
```

### Produção (aplicar migrations sem gerar novas)
```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

## 5) Autenticação (cookie + CSRF)
### Bootstrap root (uma vez)
```bash
curl -H "Content-Type: application/json" \
  -d '{"password":"change-me"}' \
  http://localhost:3001/api/auth/setup
```

### Login via curl (com CSRF)
```bash
CSRF=$(curl -s -c /tmp/td2.cookies http://localhost:3001/api/auth/csrf | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')

curl -c /tmp/td2.cookies -b /tmp/td2.cookies \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"root@local.test","password":"change-me"}' \
  http://localhost:3001/api/auth/login
```

## 6) IA (Gemini)
No `apps/api/.env`:
- `GEMINI_API_KEY=...`
- `AI_REQUIRE_AUTH=true`
- `AI_REQUIRE_PERMISSIONS=ai.chat.use`

Se a chave vazar: revogar/rotacionar imediatamente.

## 7) Deploy com Caddy
### LAN (HTTP)
Usa `infra/Caddyfile` já pronto.

### Domínio + HTTPS
```bash
cp infra/Caddyfile.domain.example infra/Caddyfile
# editar domínio no Caddyfile
npm -w apps/web run build
docker compose -f docker-compose.prod.yml up -d
```

No `apps/api/.env` para produção:
- `COOKIE_SECURE=true`
- `TRUST_PROXY=true`
- `ENABLE_HSTS=true`
- `CORS_ORIGIN=https://SEU_DOMINIO`

Process manager (escolha um):
- PM2: `infra/pm2/ecosystem.config.cjs`
- systemd: `infra/systemd/td2-api.service`

## 8) Incidentes comuns e correção
### A) `Prisma schema engine error`
1. Verificar Postgres:
```bash
docker compose up -d
```
2. Verificar `DATABASE_URL` em `apps/api/.env`
3. Rodar:
```bash
cd apps/api
npx prisma validate
npx prisma generate
npx prisma migrate dev
```

### B) `401 Unauthorized` no frontend
- Sessão expirada/cookie inválido.
- Faça logout/login novamente.

### C) `403 Invalid CSRF token`
- Recarregue a página.
- Em chamadas manuais, obtenha `/api/auth/csrf` e envie `X-CSRF-Token`.

### D) CORS bloqueando requests
- Ajustar `CORS_ORIGIN` com origem exata do frontend (IP/domínio + porta).

### E) IA não responde
1. Confirmar `GEMINI_API_KEY`
2. Confirmar permissão `ai.chat.use` no perfil do usuário
3. Checar rate limit (`AI_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_WINDOW_MS`)

## 9) Checklist pré-importação grande
1. Rodar backup (`npm run db:backup`)
2. Confirmar migrations aplicadas
3. Confirmar usuário admin logado
4. Executar importação
5. Validar catálogo/build/mapa após import

## 11) Fila de importação XLSX
- O upload agora é assíncrono (job em fila).
- Estados: `QUEUED`, `PROCESSING`, `DONE`, `FAILED`.
- A tela Admin Import mostra progresso por etapas, resultado e retry.

Endpoints:
- `POST /api/imports/xlsx`
- `GET /api/imports/jobs?limit=20`
- `GET /api/imports/jobs/:id`
- `POST /api/imports/jobs/:id/retry`

## 12) Auditoria (consulta)
- Backend registra audit log em endpoints sensíveis.
- Consulta disponível em `Admin > Auditoria`.
- Permissão necessária: `admin.audit.view`.
- Monitor operacional disponível em `Admin > Monitor`.
- Permissão necessária: `admin.monitor.view`.

## 13) Monitoramento e alerta
Health endpoints:
- `GET /api/health`
- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/admin/monitor` (requer login + permissão `admin.monitor.view`)

Script:
```bash
npm run monitor:health
```

Opcional webhook:
- `ALERT_WEBHOOK_URL=https://...`

Cron de referência:
- `infra/cron/td2-maintenance.cron`
- Inclui backup diário, restore-check mensal e health-check a cada 2 min.

## 14) E2E (API)
```bash
npm run test:e2e
```
Variáveis:
- `E2E_EMAIL` (default: `root@local.test`)
- `E2E_PASSWORD` (default: `td2e2e123`)

## 10) Arquivos críticos
- `apps/api/.env`
- `apps/web/.env`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/*`
- `infra/Caddyfile`
- `docker-compose.yml`
- `docker-compose.prod.yml`
