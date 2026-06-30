# Deployment & DevOps

## 1. Local Development Setup

### Prerequisites
- Node.js 20 LTS
- pnpm 9+
- Docker (for PostgreSQL)
- An Inngest account (or use Inngest dev server locally)
- A Polar.sh account (sandbox mode for development)

### Step-by-Step

**1. Clone and install dependencies**
```bash
git clone <repo-url>
cd flowforge/frontend
pnpm install
```

**2. Start PostgreSQL via Docker**
```bash
cd ..       # back to repo root
docker compose up -d
```

**3. Configure environment variables**
```bash
cd frontend
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/flowforge

# Auth
APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<generate: openssl rand -hex 32>

# Credential encryption
ENCRYPTION_KEY=<generate: openssl rand -hex 32>

# Inngest (dev mode)
INNGEST_DEV=1

# OpenAI (optional — only needed for OPENAI node)
OPENAI_API_KEY=sk-...

# Polar.sh
POLAR_ACCESS_TOKEN=<from Polar.sh sandbox dashboard>
POLAR_SUCCESS_URL=/workflows
```

**4. Run database migrations**
```bash
pnpm db:migrate
```

**5. Seed the database (optional)**
```bash
pnpm db:seed
```
Seeds default `TriggerSetting` rows for all trigger kinds.

**6. Start all services**

Option A — all at once (via mprocs):
```bash
pnpm dev:all
```
This starts: Next.js dev server, Inngest dev server simultaneously.

Option B — separately:
```bash
# Terminal 1: Next.js
pnpm dev

# Terminal 2: Inngest dev server
pnpm dev:inngest
```

**7. Bootstrap the first admin user**

After signing up with the first account:
```bash
npx tsx scripts/bootstrap-admin.ts
```
Follow the prompt to promote your user email to ADMIN.

**8. Open the application**
- App: `http://localhost:3000`
- Inngest dev UI: `http://localhost:8288`
- Prisma Studio: `pnpm db:studio` → `http://localhost:5555`

---

## 2. Webhook Testing (Local)

To test Google Form and Stripe triggers locally, your `localhost` needs to be publicly accessible. FlowForge uses ngrok:

```bash
pnpm dev:ngrok
```

This opens a tunnel at `handsaw-koala-unhitched.ngrok-free.app` → `localhost:3000`.

You must also add the ngrok domain to your `.env`:
```env
APP_ALLOWED_HOSTS=handsaw-koala-unhitched.ngrok-free.app
APP_TRUSTED_ORIGINS=https://handsaw-koala-unhitched.ngrok-free.app
```

Webhook URLs for testing:
- Google Form: `https://handsaw-koala-unhitched.ngrok-free.app/api/webhooks/google-form?workflowId=<id>`
- Stripe: `https://handsaw-koala-unhitched.ngrok-free.app/api/webhooks/stripe?workflowId=<id>`

---

## 3. Environment Variables Reference

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `BETTER_AUTH_SECRET` | Yes | Session signing secret (32+ chars) | `openssl rand -hex 32` output |
| `BETTER_AUTH_URL` | Yes | Canonical app URL | `https://app.example.com` |
| `APP_URL` | Yes | Same as BETTER_AUTH_URL (fallback) | `https://app.example.com` |
| `ENCRYPTION_KEY` | Yes | AES key for credentials (32+ chars) | `openssl rand -hex 32` output |
| `POLAR_ACCESS_TOKEN` | Yes | Polar.sh API token | From Polar dashboard |
| `POLAR_SUCCESS_URL` | Yes | Post-checkout redirect path | `/workflows` |
| `INNGEST_DEV` | Dev only | Enable local Inngest dev server | `1` |
| `OPENAI_API_KEY` | Optional | Default OpenAI key (not used in prod) | `sk-...` |
| `APP_ALLOWED_HOSTS` | Optional | Extra hosts to allow (comma-separated) | `*.ngrok-free.app` |
| `APP_TRUSTED_ORIGINS` | Optional | CSRF trusted origins (comma-separated) | `https://app.ngrok.io` |

> **Critical**: `ENCRYPTION_KEY` must never change after credentials have been created. Changing it will make all existing credentials unreadable. Store it securely (secrets manager, not `.env` in production).

---

## 4. Build Process

```bash
cd frontend

# 1. Install dependencies
pnpm install

# 2. Generate Prisma client
pnpm db:generate

# 3. Build the Next.js application
pnpm build
```

The production build outputs to `frontend/.next/`.

---

## 5. Production Deployment

### Next.js Application

FlowForge is a standard Next.js application that can be deployed to any Node.js host:

**Self-hosted (Node.js)**:
```bash
pnpm build
pnpm start   # starts the Next.js production server on port 3000
```

**Vercel** (recommended for Next.js):
- Push to GitHub and connect to Vercel.
- Set all environment variables in the Vercel project settings.
- Vercel handles builds and deployments automatically.

**Docker**:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install && pnpm db:generate && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json .
RUN corepack enable && pnpm install --prod
CMD ["pnpm", "start"]
```

### Database (Production)

Options:
- **Neon** (recommended) — serverless PostgreSQL, free tier, native pg driver support.
- **Supabase** — Managed PostgreSQL with additional tooling.
- **Railway** — Simple managed PostgreSQL.
- **Self-hosted** — Any PostgreSQL 14+ instance.

Run migrations before starting the server:
```bash
npx prisma migrate deploy
```

### Inngest (Production)

1. Create an account at [inngest.com](https://www.inngest.com).
2. Add the app in the Inngest dashboard and get the **Signing Key**.
3. Add to your environment: `INNGEST_SIGNING_KEY=<key>`.
4. Remove `INNGEST_DEV=1` from production environment.
5. Point Inngest to your production app URL (`https://your-app.com/api/inngest`).

### Polar.sh (Production)

1. Switch `lib/polar.ts` from `server: 'sandbox'` to `server: 'production'`.
2. Generate a production access token in the Polar.sh dashboard.
3. Update `POLAR_ACCESS_TOKEN` in production environment.
4. Create the Pro product in the Polar.sh production dashboard and update the product ID in `lib/auth.ts`.

---

## 6. Database Migrations in Production

```bash
# Run all pending migrations
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

Never use `prisma migrate dev` in production — it can ask for confirmation and detect schema drift. Use `migrate deploy`.

---

## 7. Scripts Reference

| Script | Command | Description |
|---|---|---|
| Development server | `pnpm dev` | Next.js dev server on port 3000 |
| Inngest dev server | `pnpm dev:inngest` | Inngest local dev server on port 8288 |
| All services | `pnpm dev:all` | mprocs runner (Next.js + Inngest) |
| ngrok tunnel | `pnpm dev:ngrok` | ngrok tunnel to localhost:3000 |
| Database migrate | `pnpm db:migrate` | Run migrations (dev mode) |
| Database generate | `pnpm db:generate` | Regenerate Prisma client |
| Database seed | `pnpm db:seed` | Run seed script |
| Database studio | `pnpm db:studio` | Open Prisma Studio UI |
| Production build | `pnpm build` | Next.js production build |
| Production start | `pnpm start` | Start production server |
| Lint | `pnpm lint` | ESLint |
| Type check | `pnpm typecheck` | TypeScript type check (no emit) |
| Tests | `pnpm test` | Run Vitest test suite |
| Tests (watch) | `pnpm test:watch` | Vitest in watch mode |
| Bootstrap admin | `npx tsx scripts/bootstrap-admin.ts` | Promote first user to ADMIN |

---

## 8. Infrastructure Overview

```
┌─────────────────────────────────────────────────────┐
│  Production Environment                             │
│                                                     │
│  ┌──────────────────┐   ┌────────────────────────┐  │
│  │  Next.js App     │   │  Inngest Cloud         │  │
│  │  (Vercel/Node)   │◄──│  Durable functions     │  │
│  │                  │   │  Realtime channels     │  │
│  └───────┬──────────┘   └────────────────────────┘  │
│          │                                           │
│  ┌───────▼──────────┐   ┌────────────────────────┐  │
│  │  PostgreSQL      │   │  Polar.sh              │  │
│  │  (Neon/Supabase) │   │  Subscription billing  │  │
│  └──────────────────┘   └────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 9. Secrets Management

| Secret | Sensitivity | Rotation Impact |
|---|---|---|
| `BETTER_AUTH_SECRET` | High | Rotating invalidates all active sessions |
| `ENCRYPTION_KEY` | Critical | Rotating makes all stored credentials unreadable |
| `POLAR_ACCESS_TOKEN` | High | Rotating breaks subscription checks until updated |
| `DATABASE_URL` | High | Rotating requires app restart |

**Recommendations**:
- Store all secrets in a secrets manager (AWS Secrets Manager, Doppler, Vercel Environment Variables) — never in `.env` files committed to version control.
- Treat `ENCRYPTION_KEY` as permanently fixed after first deployment; back it up separately.
- Rotate `BETTER_AUTH_SECRET` only during planned maintenance windows.

---

## 10. Monitoring

### Application Logs
Next.js logs to stdout. Capture these with your hosting provider's log aggregator (Vercel Logs, AWS CloudWatch, Datadog, etc.).

Key log events to monitor:
- `trigger.execution.blocked` — A trigger was disabled; workflows are being blocked.
- `openai.structured_output.fallback` — gpt-4o-mini failed structured output; falling back to gpt-4 (higher cost).
- `discord.ai_output.validated` — Discord node successfully validated AI output.

### Inngest Dashboard
The Inngest cloud dashboard shows:
- Function run history with step traces.
- Failed runs with error details.
- Replay failed events.

### Execution History (in-app)
The `/executions` page shows all execution records with status, timing, and error details. This is the primary debugging tool for end users.
