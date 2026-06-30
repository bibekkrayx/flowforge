# Tech Stack Documentation

A complete reference for every technology in the FlowForge stack, including purpose, rationale, configuration, and dependencies.

---

## Runtime and Framework

### Next.js 16.2 (App Router)
- **Purpose**: Full-stack React framework serving both the UI and server-side API logic.
- **Why**: Eliminates the need for a separate API server. Server Actions, Route Handlers, and React Server Components all live in one codebase. App Router provides streaming, layouts, and nested route groups.
- **Used for**: All pages, tRPC API route, auth route, webhook routes, server actions.
- **Config**: `frontend/next.config.*` (implied default; no custom config file observed).
- **Docs agent note**: See `frontend/AGENTS.md` — this version has breaking changes from older Next.js. Read `node_modules/next/dist/docs/` before making changes.

### React 19
- **Purpose**: UI component library.
- **Why**: Peer dependency of Next.js 16; React 19 brings stable server components and the new `use()` hook.
- **Dependencies**: `react-dom`, `@types/react`, `@types/react-dom`.

### TypeScript 5
- **Purpose**: Static type checking across the entire codebase.
- **Config**: `frontend/tsconfig.json`.
- **Used everywhere**: All `.ts` and `.tsx` files. Prisma-generated types flow through to tRPC and component props.

---

## Database

### PostgreSQL
- **Purpose**: Primary relational data store.
- **Why**: Relational model fits the workflow domain (workflows → nodes → connections; users → credentials). Prisma first-class support.
- **Driver**: `pg` (node-postgres) v8.
- **Connection**: `DATABASE_URL` env var; managed as a native connection pool via `@prisma/adapter-pg`.

### Prisma 7
- **Purpose**: ORM, schema definition, migration management, type-safe query builder.
- **Why**: Generates TypeScript types from the schema; `prisma migrate dev` handles migrations; integrates with better-auth's Prisma adapter.
- **Schema**: `frontend/prisma/schema.prisma`.
- **Generated client**: `frontend/generated/prisma/` (custom output path).
- **Commands**: `db:migrate`, `db:generate`, `db:seed`, `db:studio`.
- **Adapter**: `@prisma/adapter-pg` — native pg driver adapter (bypasses the standard connection URL pooler, required for Prisma 7+).

---

## Authentication

### better-auth 1.6
- **Purpose**: Authentication framework (sessions, email/password, admin roles, OAuth-ready).
- **Why**: Provides a complete auth solution (sessions, roles, ban/unban, impersonation) with a Prisma adapter and a Polar.sh plugin. Avoids writing auth from scratch.
- **Config**: `frontend/lib/auth.ts`.
- **Plugins used**:
  - `admin` — role management, user banning, impersonation
  - `nextCookies` — HTTP-only cookie handling for Next.js App Router
  - `polar` — creates Polar.sh customer on signup; exposes checkout/portal/usage
- **Session storage**: PostgreSQL via `prismaAdapter`.
- **Client**: `frontend/lib/auth-client.ts` — browser-side auth client.

---

## API Layer

### tRPC 11
- **Purpose**: Type-safe RPC framework. Replaces REST for internal frontend-to-server calls.
- **Why**: Full TypeScript type inference from server procedure to client call, eliminating `any`-typed fetch calls. Tight integration with TanStack Query.
- **Router**: `frontend/trpc/router/_app.ts`.
- **Init**: `frontend/trpc/init.ts` — procedures, context, middleware.
- **Client**: `frontend/trpc/client.tsx` — React provider with TanStack Query.
- **Server caller**: `frontend/trpc/server.tsx` — for RSC-side prefetch.
- **Transport**: HTTP (POST) via Next.js route handler at `/api/trpc/[trpc]`.
- **Serializer**: `superjson` (handles Date, undefined, BigInt transparently).
- **Dependencies**: `@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query`.

---

## State Management

### TanStack Query (React Query) 5
- **Purpose**: Server state management — caching, refetching, invalidation.
- **Why**: Used via tRPC's TanStack adapter. Handles loading/error states, optimistic updates, and background refetches automatically.
- **Used for**: All tRPC queries and mutations on the client.

### Jotai 2
- **Purpose**: Client-side global atom-based state.
- **Why**: Lightweight alternative to Redux/Zustand. Used for small, truly global state that isn't server-derived.
- **Atoms**:
  - `editorAtom` (`features/editor/store/atoms.ts`) — React Flow editor instance ref.
  - `upgradeModalAtom` (`hooks/use-upgrade-modal.tsx`) — upgrade dialog visibility.
- **Provider**: Wrapped in `app/layout.tsx`.

### nuqs 2
- **Purpose**: Type-safe URL query parameter state.
- **Why**: Pagination page numbers and search filters are encoded in the URL so they survive navigation and are shareable.
- **Used for**: Pagination (`page`, `pageSize`) and search (`search`) in workflow, credential, and execution lists.
- **Adapter**: `NuqsAdapter` from `nuqs/adapters/next/app` in root layout.

---

## UI and Styling

### Tailwind CSS 4
- **Purpose**: Utility-first CSS framework.
- **Why**: Rapid prototyping, consistent design tokens, zero dead CSS.
- **Config**: `postcss.config.mjs`.
- **Theme**: CSS variables in `app/globals.css`.

### shadcn/ui 4
- **Purpose**: Accessible, composable UI component library built on Radix UI.
- **Why**: Pre-built accessible primitives with full source ownership (components are copied into `components/ui/`, not imported from a package).
- **Components**: Full set in `components/ui/` — Button, Dialog, Sidebar, Input, Select, Table, etc.
- **Config**: `components.json`.

### Radix UI (`radix-ui`)
- **Purpose**: Headless accessible primitives backing shadcn/ui.
- **Used for**: Popover, DropdownMenu, Dialog, Tooltip, etc.

### @xyflow/react 12 (React Flow)
- **Purpose**: Interactive node-graph canvas for the workflow editor.
- **Why**: Purpose-built for node-based UIs; handles panning, zooming, edge drawing, handle connection detection, and minimap out of the box.
- **Used for**: `features/editor/components/editor.tsx` — the entire workflow canvas.
- **Custom nodes**: Registered in `config/node-components.ts`.

### Lucide React
- **Purpose**: Icon library.
- **Used for**: All icons throughout the UI.

### next-themes
- **Purpose**: Dark mode support.
- **Used for**: Root layout (`className="dark"`). App is dark-mode only currently.

### Fonts
- `Roboto Slab` — body font (`--font-roboto-slab`)
- `JetBrains Mono` — heading/code font (`--font-jetbrains-heading`)
- Loaded via `next/font/google` in root layout.

---

## Background Jobs and Realtime

### Inngest 4
- **Purpose**: Durable background function execution + realtime WebSocket event broadcasting.
- **Why**: Workflows can take seconds to minutes; running them in an HTTP request would time out. Inngest provides durability, step functions, retry logic, telemetry, and a realtime pub/sub channel per function run.
- **Client**: `frontend/inngest/client.ts` (app ID: `flowforge`).
- **Functions**: `frontend/inngest/functions.ts` — `execute-workflow`.
- **Events**: `frontend/inngest/events.ts` — `workflows/execute.workflow`.
- **Channels**: `frontend/inngest/channels/` — per-node-type realtime channels + workflow execution channel.
- **Dev server**: Run with `pnpm dev:inngest` at `http://localhost:8288`.

### @inngest/realtime
- **Purpose**: WebSocket subscription on the browser side.
- **Why**: Pushes live node status events to the canvas during execution without polling.
- **Used for**: `useRealtime()` hook in `WorkflowExecutionSubscriber`.

---

## AI Providers

### Vercel AI SDK (`ai` v6)
- **Purpose**: Unified interface for calling LLM providers (OpenAI, Anthropic, Google).
- **Why**: Consistent API across providers; supports structured output (`generateObject`), `step.ai.wrap()` integration with Inngest for telemetry.
- **Used for**: All AI node executors.

### @ai-sdk/openai
- **Model**: `gpt-4o-mini` (structured output via `generateObject`), `gpt-4` (fallback via `generateText`).
- **Used for**: OPENAI node executor (`features/execution/components/openai/executor.ts`).

### @ai-sdk/anthropic
- **Model**: `claude-sonnet-4-5`.
- **Used for**: ANTHROPIC node executor (`features/execution/components/anthropic/executor.ts`).

### @ai-sdk/google
- **Model**: `gemini-2.0-flash`.
- **Used for**: GEMINI node executor (`features/execution/components/gemini/executor.ts`).

---

## Payments and Billing

### Polar.sh SDK (`@polar-sh/sdk` v0.47)
- **Purpose**: Subscription management, checkout, customer portal.
- **Why**: Integrated Polar.sh plugin for better-auth makes customer creation and subscription gating straightforward.
- **Config**: `frontend/lib/polar.ts` — client initialized with `POLAR_ACCESS_TOKEN`. Note: currently set to `server: 'sandbox'`.
- **better-auth plugin**: `@polar-sh/better-auth` — `checkout`, `portal`, `usage`.
- **Used for**: `premiumProcedure` subscription check; sidebar upgrade button; billing portal button.

---

## Forms and Validation

### react-hook-form 7 + Zod 4
- **Purpose**: Form state management and schema validation.
- **Used for**: Login form, signup form, credential forms, admin forms.
- **Adapter**: `@hookform/resolvers/zod` for Zod schema integration.

### @tanstack/react-form 1
- **Purpose**: Alternative form library for some forms.
- **Used alongside**: react-hook-form (both are present in the codebase).

### Zod 4
- **Purpose**: Schema definition and runtime validation throughout the application.
- **Used for**: tRPC input schemas, form validation schemas, AI output validation schemas.

---

## Templating

### Handlebars 4
- **Purpose**: Template engine for dynamic prompt and message content.
- **Why**: Allows users to reference prior node outputs in prompts and messages using `{{variableName}}` syntax.
- **Used for**: All AI node system/user prompts, HTTP Request body, Slack message content.
- **Custom helper**: `{{json anyObject}}` — renders any value as formatted JSON.

---

## Encryption

### Cryptr 6
- **Purpose**: Symmetric AES encryption/decryption.
- **Used for**: Encrypting API credentials at rest (`lib/encryption.ts`).
- **Key**: `ENCRYPTION_KEY` environment variable. Changing this key breaks all existing credentials.

---

## HTTP Client

### ky 2
- **Purpose**: Modern `fetch`-based HTTP client with sensible defaults.
- **Used for**: HTTP Request node executor (making arbitrary HTTP calls), Slack webhook calls.

---

## Routing and URL Utilities

### nuqs 2 (URL state)
See State Management section above.

### random-word-slugs
- **Purpose**: Generate human-readable random workflow names.
- **Used for**: `workflows.create` tRPC procedure (3-word slug).

### @paralleldrive/cuid2
- **Purpose**: Collision-resistant unique ID generation.
- **Used for**: Generating Inngest event IDs (`sendWorkflowExecution`).

### toposort
- **Purpose**: Topological sort of a directed graph.
- **Used for**: `inngest/utils.ts` — sorting workflow nodes by dependency order before execution.

---

## Developer Tooling

### mprocs
- **Purpose**: Run multiple terminal processes simultaneously.
- **Config**: `frontend/mprocs.yaml`.
- **Used for**: `pnpm dev:all` — runs Next.js dev server, Inngest dev server, and optionally ngrok in parallel.

### ngrok
- **Purpose**: Expose localhost to the internet for webhook testing.
- **Script**: `pnpm dev:ngrok` — runs with a fixed URL (handsaw-koala-unhitched.ngrok-free.dev).
- **Used for**: Testing Google Form and Stripe webhook triggers locally.

### Vitest 3
- **Purpose**: Unit test runner.
- **Config**: `frontend/vitest.config.ts`.
- **Used for**: Testing AI utility functions, Discord helpers, trigger enforcement logic, permissions.

### ESLint 9 + eslint-config-next
- **Purpose**: Code linting.
- **Script**: `pnpm lint`.

### tsx 4
- **Purpose**: TypeScript execution without compilation (for scripts).
- **Used for**: `prisma/seed.ts`, `scripts/bootstrap-admin.ts`.
