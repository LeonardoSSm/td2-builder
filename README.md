# TD2 Builder

Plataforma para criação e gestão de builds do **The Division 2**.

## Stack
- `apps/api`: NestJS + Prisma + PostgreSQL
- `apps/web`: React + Vite + TanStack Query
- Banco: PostgreSQL (Docker)

## Requisitos
- Node.js `>=20.19` (recomendado `22.12+`)
- npm
- Docker + Docker Compose

Opcional (nvm):
```bash
nvm install
nvm use
node -v
```

## Estrutura
```text
apps/
  api/
  web/
infra/
  Caddyfile
  Caddyfile.example
  Caddyfile.domain.example
scripts/
```

## Setup local (dev)
### 1) Subir PostgreSQL
```bash
docker compose up -d
```

### 2) Instalar dependências
```bash
npm install
```

### 3) Configurar ambiente
API:
```bash
cp apps/api/.env.example apps/api/.env
```
Web:
```bash
cp apps/web/.env.example apps/web/.env
```

Ajuste no mínimo:
- `apps/api/.env`
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `CORS_ORIGIN`
- `apps/web/.env`
  - `VITE_API_URL`

### 4) Migrar banco + gerar cliente Prisma
```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
cd ../..
```

### 5) Rodar API e Web
```bash
npm run dev:api
npm run dev:web
```

Acessos:
- Web: `http://localhost:5173`
- API health: `http://localhost:3001/api/health`

## Autenticação (cookie HttpOnly + CSRF)
O projeto usa:
- Access token em cookie HttpOnly
- Refresh token rotativo em cookie HttpOnly
- CSRF token (double-submit) para métodos de escrita

### Bootstrap da senha root (uma vez)
```bash
curl -H "Content-Type: application/json" \
  -d '{"password":"change-me"}' \
  http://localhost:3001/api/auth/setup
```

### Login via browser
- Acesse `/login`
- Use `root@local.test` + senha definida no setup

### Login via curl (com CSRF)
```bash
CSRF=$(curl -s -c /tmp/td2.cookies http://localhost:3001/api/auth/csrf | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')

curl -c /tmp/td2.cookies -b /tmp/td2.cookies \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"root@local.test","password":"change-me"}' \
  http://localhost:3001/api/auth/login

curl -b /tmp/td2.cookies http://localhost:3001/api/auth/me
```

## Permissões
Permissões disponíveis (Access Control):
- `admin.items.manage`
- `admin.import.run`
- `admin.recommended.manage`
- `admin.users.manage`
- `admin.maps.manage`
- `admin.audit.view`
- `ai.chat.use`

Gestão no módulo: **Admin > Usuários e Permissões**.

## IA (Gemini)
Endpoint:
- `POST /api/ai/chat`

Env relevantes (`apps/api/.env`):
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_MAX_TOKENS`
- `GEMINI_TEMPERATURE`
- `AI_REQUIRE_AUTH=true`
- `AI_REQUIRE_PERMISSIONS=ai.chat.use`
- `AI_RATE_LIMIT_MAX`
- `AI_RATE_LIMIT_WINDOW_MS`

Segurança:
- Se a chave foi exposta, **rotacione/revogue imediatamente**.
- Nunca commitar `.env` com chave real.

## Importação XLSX
Tela:
- **Admin > Importar**

Fluxo atual:
- Upload cria um **job assíncrono** (`QUEUED` -> `PROCESSING` -> `DONE/FAILED`)
- A tela mostra progresso por etapas, histórico e botão de retry

Endpoints:
- `POST /api/imports/xlsx` (upload e enqueue)
- `GET /api/imports/jobs?limit=20`
- `GET /api/imports/jobs/:id`
- `POST /api/imports/jobs/:id/retry`

Arquivo exemplo:
- `data/td2_build_planner_starter_pack_v3.xlsx`

## Mapa de farm/loot
- Página pública: `/map`
- Admin: `/admin/maps`
- Upload de imagem do mapa e cadastro de áreas/círculos

## Segurança implementada
- Cookies HttpOnly para auth
- Refresh token rotativo
- CSRF em `POST/PUT/PATCH/DELETE`
- Rate-limit global (best-effort, em memória)
- Rate-limit de login (`LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_WINDOW_MS`)
- Rate-limit específico para IA
- Headers de segurança (CSP API, X-Frame-Options, etc.)
- Audit log (best-effort) em endpoints sensíveis (`/api/admin/*`, `/api/ai/*`, `/api/imports/*`)
- Consulta de auditoria em `Admin > Auditoria`

## Variáveis de ambiente importantes
### API (`apps/api/.env`)
- `PORT=3001`
- `DATABASE_URL=...`
- `CORS_ORIGIN=http://localhost:5173,...`
- `JWT_SECRET=...`
- `JWT_EXPIRES_IN=30m`
- `JWT_ISSUER=` (opcional)
- `JWT_AUDIENCE=` (opcional)
- `TRUST_PROXY=false` (dev)
- `ENABLE_HSTS=false` (dev)
- `COOKIE_SECURE=false` (dev HTTP)
- `COOKIE_SAMESITE=lax`
- `AUTH_COOKIE_ACCESS=td2_at`
- `AUTH_COOKIE_REFRESH=td2_rt`
- `AUTH_COOKIE_CSRF=td2_csrf`
- `AUTH_REFRESH_DAYS=30`
- `RATE_LIMIT_MAX=120`
- `RATE_LIMIT_WINDOW_MS=60000`

### Web (`apps/web/.env`)
- Dev local: `VITE_API_URL=http://localhost:3001/api`
- Behind proxy (recomendado): `VITE_API_URL=/api`

## Deploy com Caddy (recomendado)
### Cenário LAN (HTTP)
Já existe arquivo pronto:
- `infra/Caddyfile`

### Cenário domínio + HTTPS automático
Use:
- `infra/Caddyfile.domain.example`

Passos:
1. Build do frontend
```bash
npm -w apps/web run build
```
2. Copiar template e ajustar domínio
```bash
cp infra/Caddyfile.domain.example infra/Caddyfile
```
3. Ajustar `apps/api/.env` para produção:
- `COOKIE_SECURE=true`
- `TRUST_PROXY=true`
- `ENABLE_HSTS=true`
- `CORS_ORIGIN=https://SEU_DOMINIO`
4. Subir proxy
```bash
docker compose -f docker-compose.prod.yml up -d
```
5. Rodar API com migração de produção
```bash
npm run start:api:prod
```

Opções de processo em produção:
- PM2: `infra/pm2/ecosystem.config.cjs`
- systemd: `infra/systemd/td2-api.service`
- cron manutenção: `infra/cron/td2-maintenance.cron`

## Qualidade e testes
Lint:
```bash
npm run lint
```

Smoke API (com API em execução):
```bash
npm run test:smoke
```

E2E API (auth + csrf + fluxo crítico):
```bash
npm run test:e2e
```
Obs: para rodar local, configure:
- `E2E_EMAIL` (default: `root@local.test`)
- `E2E_PASSWORD` (default: `td2e2e123`)

Backup de banco (recomendado antes de importações grandes):
```bash
npm run db:backup
```

Restore-check (simulação de recuperação):
```bash
npm run db:restore-check
```

Monitor de saúde local (pronto para cron/webhook):
```bash
npm run monitor:health
```

## Troubleshooting
### `Prisma schema engine error`
Verifique:
1. Postgres ativo (`docker compose up -d`)
2. `DATABASE_URL` correto
3. Porta `5482` livre e acessível
4. Versão do Node dentro do suportado

### `401` no frontend
- Sessão expirada ou cookies inválidos
- Faça login novamente

### `403 Invalid CSRF token`
- Recarregue a página e tente de novo
- Em chamadas manuais, busque `/api/auth/csrf` e envie `X-CSRF-Token`

### CORS bloqueando
- Confirme `CORS_ORIGIN` com host exato do frontend (`http://IP:5173` ou domínio)

## Fluxo recomendado de uso
1. Subir banco + API + Web
2. Login admin
3. Ajustar perfis/permissões
4. Importar base inicial XLSX
5. Cadastrar/ajustar itens manualmente no Admin Itens
6. Montar builds e validar no Catálogo/Build
7. Configurar mapas de farm
8. (Opcional) ativar IA com permissão `ai.chat.use`

## Observações
- `.env` e `.env.*` estão ignorados no git.
- Não compartilhe secrets em chat, issue ou commit.
