# System Design Document

## 1. End-to-End Architecture

FlowForge is a **monolithic Next.js 16** application. All business logic — API handlers, database access, authentication, background job orchestration — lives inside a single Next.js project (`frontend/`). There is no separate microservice layer.

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  React 19  /  @xyflow/react  /  shadcn/ui                  │ │
│  │  TanStack Query (server state)  /  Jotai (local state)      │ │
│  │  Inngest useRealtime() hook (WebSocket)                     │ │
│  └──────────────────┬────────────────────────────┬─────────────┘ │
└─────────────────────│────────────────────────────│───────────────┘
                      │ tRPC + HTTP                │ SSE/WS
          ┌───────────▼──────────────┐   ┌────────▼──────────────┐
          │  Next.js Route Handlers  │   │  Inngest Cloud        │
          │  /api/trpc/[trpc]        │   │  Realtime channels    │
          │  /api/auth/[...all]      │   │  Durable functions    │
          │  /api/inngest            │   └───────────────────────┘
          │  /api/webhooks/*         │
          │  /api/workflows/*/       │
          │    execution-status      │
          │  Server Actions          │
          └──────────┬───────────────┘
                     │
          ┌──────────▼───────────────┐
          │  PostgreSQL              │
          │  (via Prisma + pg)       │
          └──────────────────────────┘
```

---

## 2. Frontend Architecture

### App Router Layout Groups

```
app/
├── layout.tsx                    Root layout (providers: tRPC, Jotai, nuqs, Toaster)
├── (auth)/
│   ├── login/page.tsx            Email/password login
│   └── signup/page.tsx           Registration
├── (dashboard)/
│   ├── layout.tsx                SidebarProvider + AppSidebar
│   ├── (editor)/
│   │   └── workflows/[workflowId]/page.tsx   React Flow editor
│   └── (rest)/
│       ├── workflows/page.tsx    Workflow list
│       ├── credentials/page.tsx  Credential list
│       ├── credentials/new/      New credential form
│       ├── credentials/[id]/     Edit credential
│       ├── executions/page.tsx   Execution history
│       ├── executions/[id]/      Execution detail
│       └── subscriptions/page.tsx
├── admin/
│   ├── login/page.tsx            Admin-specific login page
│   ├── page.tsx                  Admin root (redirects)
│   └── (protected)/
│       ├── layout.tsx            Auth guard for admin routes
│       ├── users/page.tsx        User management table
│       └── triggers/page.tsx     Trigger enable/disable
└── api/
    ├── auth/[...all]/route.ts    better-auth handler
    ├── inngest/route.ts          Inngest function handler
    ├── trpc/[trpc]/route.ts      tRPC handler
    ├── create-task/route.ts      Demo Inngest event endpoint
    ├── webhooks/
    │   ├── google-form/route.ts  Google Form webhook receiver
    │   └── stripe/route.ts       Stripe webhook receiver
    └── workflows/[workflowId]/
        └── execution-status/route.ts  Polling fallback endpoint
```

### Component Architecture

Components follow a two-tier model:

**`/components`** — Shared, reusable primitives:
- `ui/` — shadcn/ui wrappers (Button, Dialog, Sidebar, etc.)
- `react-flow/` — Base canvas primitives (BaseNode, BaseHandle, NodeStatusIndicator, PlaceholderNode)
- `app-sidebar.tsx` — Application navigation sidebar
- `workflow-node.tsx` — Generic workflow node shell
- `base-execution-node.tsx` — Execution-aware node base
- `initial-node.tsx` — The INITIAL placeholder node
- `node-selector.tsx` — Node type picker dialog

**`/features`** — Domain feature modules:
- Each feature owns its components, hooks, server routers, types, and params
- Feature modules: `auth`, `admin`, `credentials`, `editor`, `execution`, `subscriptions`, `triggers`, `workflows`

---

## 3. Backend Architecture

### tRPC Router Hierarchy

```
appRouter
├── workflows
│   ├── create          (premiumProcedure)
│   ├── remove          (protectedProcedure)
│   ├── updateName      (protectedProcedure)
│   ├── update          (protectedProcedure) — full canvas save
│   ├── updateGoogleFormTrigger (protectedProcedure)
│   ├── execute         (protectedProcedure)
│   ├── getOne          (protectedProcedure)
│   └── getMany         (protectedProcedure)
├── credentials
│   ├── create          (premiumProcedure)
│   ├── remove          (protectedProcedure)
│   ├── update          (protectedProcedure)
│   ├── getOne          (protectedProcedure)
│   ├── getMany         (protectedProcedure)
│   └── getByType       (protectedProcedure)
├── executions
│   ├── getOne          (protectedProcedure)
│   └── getMany         (protectedProcedure)
└── admin
    ├── users
    │   ├── list        (adminProcedure)
    │   ├── setRole     (adminProcedure)
    │   └── delete      (adminProcedure)
    └── triggers
        ├── list        (adminProcedure)
        └── update      (adminProcedure)
```

### Procedure Authorization Middleware

```
baseProcedure
    └── protectedProcedure      (requires valid better-auth session)
            └── premiumProcedure  (requires active Polar subscription)
            └── adminProcedure    (requires UserRole.ADMIN)
```

### Service Layer (Admin)

The admin feature uses an explicit service + repository pattern:

```
adminRouter → adminUserService / triggerSettingsService
                    │
              adminUserRepository / triggerSettingsRepository
                    │
                  prisma
```

All other features access `prisma` directly from their tRPC procedures (no intermediate service layer).

---

## 4. Data Flow Diagrams

### Workflow Canvas Save

```
User edits canvas
       │
       ▼
Editor state (React state: nodes[], edges[])
       │
       ▼ mutations.workflows.update.mutate()
       │
tRPC: workflows.update
       │
       ▼ Prisma transaction:
       │   1. DELETE all connections WHERE workflowId
       │   2. DELETE all nodes WHERE workflowId
       │   3. CREATE nodes (batch)
       │   4. CREATE connections (batch, deduplicated)
       │   5. UPDATE workflow.updatedAt
       ▼
PostgreSQL
```

### Workflow Execution Data Flow

```
initialData (from trigger)
       │
       ▼  context = initialData ?? {}
       │
[Node 1: e.g. GOOGLE_FORM_TRIGGER]
  reads: context.googleForm.*
  writes: context (passthrough)
       │
       ▼  context = { googleForm: {...} }
       │
[Node 2: e.g. OPENAI]
  reads: context via Handlebars: {{json googleForm}}
  writes: context.variableName = { text, structured }
       │
       ▼  context = { googleForm: {...}, myAiVar: { text: "..." } }
       │
[Node 3: e.g. DISCORD]
  reads: context.myAiVar.text
  calls: Discord webhook API
  writes: context.discordVar = { messageContent: "..." }
       │
       ▼  Final context saved to Execution.output
```

### Real-time Status Data Flow

```
Inngest executor
       │
       ▼ publishNodeStatus(publish, workflowId, nodeId, nodeType, "loading")
       │   ├── setCachedNodeStatus(workflowId, nodeId, ...) → WorkflowExecutionSnapshot
       │   └── inngest.realtime.publish(channel.status, event)
       │
       ├── [WebSocket path]
       │   Inngest Realtime Cloud → useRealtime() hook → applyEvent() → setNodes()
       │
       └── [Polling fallback path]
           GET /api/workflows/[id]/execution-status
               → getCachedExecution() → WorkflowExecutionSnapshot
               → syncNodeStatus() → setNodes()
```

---

## 5. Request/Response Lifecycle

### tRPC Mutation (e.g., create workflow)

```
1. Client calls: trpc.workflows.create.mutate()
2. POST /api/trpc/workflows.create
3. createTRPCContext() called (empty context)
4. premiumProcedure middleware:
   a. getSession() via better-auth (reads session cookie)
   b. polarClient.customers.getStateExternal(userId) — checks subscription
5. Route handler: prisma.workflow.create(...)
6. Response serialized with superjson
7. Client cache invalidated via TanStack Query
```

### Webhook (Google Form)

```
1. Google Form Apps Script POSTs to /api/webhooks/google-form?workflowId=xxx
2. Route handler extracts workflowId from URL
3. Parses body: { formId, formTitle, responseId, timestamp, responses, ... }
4. sendWorkflowExecution({ workflowId, initialData: { googleForm } }, { triggerKind: GOOGLE_FORM })
5. assertTriggerEnabled(GOOGLE_FORM) — checks TriggerSetting table
6. inngest.send(executeWorkflowEvent.create(data, { id: cuid() }))
7. Returns 200 OK immediately (async execution)
```

---

## 6. State Management Strategy

| State Type | Tool | Location |
|---|---|---|
| Server data (workflows, credentials, executions) | TanStack Query via tRPC | Cached in React Query client |
| Canvas node/edge state | React `useState` | Editor component local state |
| Canvas editor instance ref | Jotai atom (`editorAtom`) | Global atom for cross-component access |
| URL query parameters (pagination, filters) | nuqs | Encoded in URL search params |
| Upgrade modal visibility | Jotai atom | Global atom |
| Execution status (realtime) | React `useState` via `syncNodeStatus` callback | Editor component, injected via context |

---

## 7. Authentication and Authorization Flows

### Authentication (better-auth)

```
POST /api/auth/sign-up/email
  body: { email, password, name }
  → better-auth creates User + Account + Session
  → Returns session cookie (HTTP-only)

POST /api/auth/sign-in/email
  body: { email, password }
  → better-auth verifies password hash (Account.password)
  → Creates new Session record
  → Returns session cookie

GET /api/auth/get-session
  → Returns { user, session } or null
```

### Authorization Levels

```
Public:
  - /login, /signup, /api/auth/*
  - POST /api/webhooks/google-form
  - POST /api/webhooks/stripe

protectedProcedure (session required):
  - All user-facing tRPC procedures

premiumProcedure (session + active Polar subscription):
  - workflows.create
  - credentials.create
  - credentials.update

adminProcedure (session + role === "ADMIN"):
  - admin.users.*
  - admin.triggers.*
  - Admin UI routes (/admin/*)
```

### Polar.sh Subscription Check

On every `premiumProcedure` call:
```
polarClient.customers.getStateExternal({ externalId: userId })
  → if activeSubscriptions.length === 0 → throw FORBIDDEN
  → else → proceed
```

---

## 8. Error Handling Strategy

### Inngest Executors

- `NonRetriableError` is thrown when an error is deterministic and retrying would not help (missing configuration, invalid credential, malformed data).
- Generic `Error` is thrown for transient failures, allowing Inngest's retry mechanism to apply (note: `retries: 0` is currently set on the main function — all failures are fatal).
- `onFailure` handler on the Inngest function updates the `Execution` record to `FAILED` and records the error message + stack.

### tRPC Procedures

- `TRPCError` with `code: "UNAUTHORIZED"` for unauthenticated access.
- `TRPCError` with `code: "FORBIDDEN"` for insufficient permissions or no subscription.
- `TRPCError` with `code: "NOT_FOUND"` for missing records.
- `TRPCError` with `code: "BAD_REQUEST"` for invalid operations (e.g., removing last admin).
- Prisma `findUniqueOrThrow` / `findFirstOrThrow` propagate as `NOT_FOUND` upstream.

### Webhook Handlers

- Always return JSON `{ success: boolean, error?: string }`.
- `TriggerDisabledError` maps to HTTP 403.
- Generic errors map to HTTP 500.
- All errors are logged via `console.error` (no structured logging on webhooks currently).

---

## 9. Scalability Considerations

| Concern | Current Approach | Notes |
|---|---|---|
| Workflow execution | Inngest Cloud (external queue) | Scales independently of web server |
| Database | Single PostgreSQL instance | Bottleneck at scale; would need read replicas or partitioning |
| Node execution concurrency | Sequential per workflow | Parallel node execution not yet implemented |
| Realtime status | Inngest Realtime (managed WebSocket) | Scales with Inngest plan |
| Polling fallback | 1-second interval per open editor | Could spike DB reads with many concurrent users |
| Credential encryption | Symmetric key (per-app) | Compromised `ENCRYPTION_KEY` exposes all credentials |

---

## 10. Security Considerations

| Area | Implementation |
|---|---|
| API key storage | Encrypted with Cryptr (AES) using `ENCRYPTION_KEY` env var; decrypted only inside Inngest functions |
| Session security | better-auth HTTP-only session cookies |
| CSRF | better-auth handles CSRF for auth endpoints; tRPC POST-only mutations are not GET-exploitable |
| Webhook signature verification | **Not implemented** — Stripe and Google Form webhooks are unauthenticated. This is a known security gap. |
| Admin protection | Role check enforced at tRPC middleware level; cannot be bypassed by client |
| SQL injection | Prisma parameterized queries; no raw SQL |
| Subscription enforcement | Checked server-side in tRPC middleware, not just client-side UI |

> **Security gap**: The Stripe and Google Form webhook endpoints do not verify signatures. Any party that knows the webhook URL can trigger workflow executions. Production deployments should add signature verification.
