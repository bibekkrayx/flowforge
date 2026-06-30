# Backend Documentation

## 1. Folder Structure

The backend lives entirely inside `frontend/` (the Next.js application). There is no separate server process for the main product.

```
frontend/
├── app/api/                  Next.js Route Handlers (REST API surface)
│   ├── auth/[...all]/        better-auth all-routes handler
│   ├── inngest/              Inngest function registration endpoint
│   ├── trpc/[trpc]/          tRPC handler
│   ├── webhooks/
│   │   ├── google-form/      External Google Form webhook receiver
│   │   └── stripe/           External Stripe webhook receiver
│   └── workflows/[id]/execution-status/  Polling status endpoint
├── trpc/
│   ├── init.ts               tRPC instance, context, procedure factories
│   ├── router/_app.ts        Root router assembling all sub-routers
│   ├── client.tsx            React Query provider (client-side)
│   ├── server.tsx            RSC caller factory (server-side)
│   └── query-client.ts       TanStack Query client factory
├── features/*/server/        Feature tRPC routers, services, repositories
├── inngest/
│   ├── client.ts             Inngest client (app ID: flowforge)
│   ├── events.ts             Typed Inngest event definitions
│   ├── functions.ts          Main execute-workflow Inngest function
│   ├── utils.ts              sendWorkflowExecution, topologicalSort
│   └── channels/             Per-node realtime channel definitions
├── lib/
│   ├── auth.ts               better-auth instance + configuration
│   ├── auth-utils.ts         Auth helpers
│   ├── encryption.ts         encrypt/decrypt (Cryptr AES)
│   ├── execution-status-store.ts  WorkflowExecutionSnapshot CRUD
│   ├── permissions.ts        Role constants and checks
│   ├── polar.ts              Polar.sh SDK client
│   ├── prisma.ts             Prisma client singleton
│   ├── resolve-google-form-workflow.ts  Form→workflow resolution logic
│   ├── triggers/enforcement.ts  Trigger enabled/disabled checks
│   ├── ai/                   AI generation utilities
│   ├── discord/              Discord webhook utilities
│   └── logger.ts             Structured logger
└── prisma/
    ├── schema.prisma         Database schema
    ├── seed.ts               Database seeder
    └── migrations/           Migration SQL files
```

---

## 2. tRPC Service Architecture

### Context Creation
`frontend/trpc/init.ts` creates an empty context object. Authentication state is not injected at context creation time — each protected procedure independently calls `auth.api.getSession()` using `next/headers`.

```ts
export const createTRPCContext = async (opts?: { headers: Headers }) => {
  return {};
};
```

### Procedure Factories

| Factory | Middleware | Adds to Context |
|---|---|---|
| `baseProcedure` | None | — |
| `protectedProcedure` | Session check | `ctx.auth = { user, session }` |
| `premiumProcedure` | Session + subscription check | `ctx.customer = PolarCustomerState` |
| `adminProcedure` | Session + role check | — |

**`protectedProcedure`**: Calls `auth.api.getSession({ headers: await headers() })`. Returns `UNAUTHORIZED` if no session.

**`premiumProcedure`**: Extends `protectedProcedure`. Calls `polarClient.customers.getStateExternal({ externalId: userId })`. Returns `FORBIDDEN` if `activeSubscriptions.length === 0`.

**`adminProcedure`**: Extends `protectedProcedure`. Checks `isAdminRole(ctx.auth.user.role)`. Returns `FORBIDDEN` if not admin.

---

## 3. tRPC Routers

### `workflowsRouter` (`features/workflows/server/routers.ts`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `create` | mutation | Premium | Creates workflow with random name and INITIAL node |
| `remove` | mutation | Protected | Deletes workflow by ID (user-scoped) |
| `updateName` | mutation | Protected | Renames a workflow |
| `update` | mutation | Protected | Saves full canvas state (nodes + edges) in a transaction |
| `updateGoogleFormTrigger` | mutation | Protected | Sets form ID on a GOOGLE_FORM_TRIGGER node |
| `execute` | mutation | Protected | Sends `workflows/execute.workflow` Inngest event |
| `getOne` | query | Protected | Returns workflow with nodes + edges in React Flow format |
| `getMany` | query | Protected | Paginated + searchable workflow list |

### `credentialsRouter` (`features/credentials/server/routers.ts`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `create` | mutation | Premium | Creates encrypted credential |
| `remove` | mutation | Protected | Deletes credential |
| `update` | mutation | Protected | Updates name, type, and re-encrypts value |
| `getOne` | query | Protected | Fetches single credential |
| `getMany` | query | Protected | Paginated + searchable credential list |
| `getByType` | query | Protected | Fetches credentials filtered by type |

### `executionsRouter` (`features/execution/server/routers.ts`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `getOne` | query | Protected | Fetches a single execution (includes workflow name) |
| `getMany` | query | Protected | Paginated execution list (newest first) |

### `adminRouter` (`features/admin/server/routers.ts`)

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `users.list` | query | Admin | Paginated + searchable user list |
| `users.setRole` | mutation | Admin | Promotes/demotes a user's role |
| `users.delete` | mutation | Admin | Removes a user from the platform |
| `triggers.list` | query | Admin | Returns all trigger kind settings |
| `triggers.update` | mutation | Admin | Bulk updates trigger enabled/disabled state |

---

## 4. Admin Service Layer

The admin feature uses an explicit service + repository pattern (the only feature that does):

### `adminUserService` (`features/admin/services/admin-user.service.ts`)
Business logic layer for admin user operations:
- `listUsers(input)` — delegates to repository, adds pagination metadata
- `setUserRole(actorId, input)` — guards: prevents self-demotion, prevents removing last admin, then calls `auth.api.setRole()`
- `deleteUser(actorId, input)` — guards: prevents self-deletion, prevents deleting last admin, then calls `auth.api.removeUser()`

### `triggerSettingsService` (`features/admin/services/trigger-settings.service.ts`)
- `getSettings()` — delegates to repository
- `updateSettings(actorId, input)` — upserts each trigger setting, logs the action

### Repositories
- `adminUserRepository` — wraps Prisma queries for user listing, counting by role, finding by ID
- `triggerSettingsRepository` — wraps Prisma upsert for `TriggerSetting` table

---

## 5. Workflow Execution Engine

The execution engine is a single Inngest durable function: `execute-workflow`.

### Entry Points

| Entry Point | Trigger |
|---|---|
| `trpc.workflows.execute` | Manual button in editor |
| `POST /api/webhooks/google-form` | Google Form submission |
| `POST /api/webhooks/stripe` | Stripe event |

All entry points call `sendWorkflowExecution(data, { triggerKind })` which:
1. Asserts the trigger kind is enabled (queries `TriggerSetting` table).
2. Sends the Inngest event with a CUID2 event ID.

### Inngest Function (`inngest/functions.ts`)

```
execute-workflow (inngest function)
  retries: 0
  onFailure: updates Execution.status = FAILED

Steps:
  1. "create-execution"       → prisma.execution.create(...)
  2. "prepare-workflow"       → load workflow, assert triggers, topological sort
  publishExecutionStarted()   → reset snapshot + publish "execution.started" to realtime
  3-N. Per node:
    executor(params)          → publishNodeStatus("loading") + run + publishNodeStatus("success"/"error")
  publishExecutionCompleted() → update snapshot phase + publish "execution.completed"
  N+1. "update-execution"     → prisma.execution.update(status=SUCCESS, output=context)
```

### Topological Sort (`inngest/utils.ts`)
The `topologicalSort(nodes, connections)` function:
- Builds an edge list `[fromNodeId, toNodeId][]` from connections.
- Handles isolated nodes (no connections) by adding self-edges to keep them in the sort.
- Uses `toposort` library to produce a sorted node ID list.
- Maps IDs back to Node objects.
- Throws if the graph contains a cycle.

### Execution Context
`WorkflowContext = Record<string, unknown>`

- Initialized from `initialData` (webhook payload) or `{}` for manual triggers.
- Each executor receives the current context and returns an updated context.
- Executors store their output under `data.variableName`:
  ```ts
  return { ...context, [data.variableName]: { text: "...", ... } }
  ```
- Downstream nodes access upstream outputs via Handlebars: `{{variableName.field}}`.

### Executor Pattern

Every node executor implements `NodeExecutor<TData>`:
```ts
type NodeExecutor<TData> = (params: NodeExecutorParams<TData>) => Promise<WorkflowContext>
```

Standard executor flow:
```ts
async (params) => {
  await publishNodeStatus(publish, workflowId, nodeId, nodeType, "loading");
  try {
    // ... do the work (inside step.run()) ...
    await publishNodeStatus(publish, workflowId, nodeId, nodeType, "success");
    return updatedContext;
  } catch (error) {
    await publishNodeStatus(publish, workflowId, nodeId, nodeType, "error");
    throw error;
  }
}
```

The `step.run("step-name", fn)` wrapper ensures the step is recorded by Inngest for deduplication and replay.

### Executor Registry (`features/execution/libs/executor-registry.tsx`)

```ts
executorRegistry: Record<NodeType, NodeExecutor> = {
  [NodeType.INITIAL]:              manualTriggerExecutor,
  [NodeType.MANUAL_TRIGGER]:       manualTriggerExecutor,
  [NodeType.HTTP_REQUEST]:         httpRequestExecutor,
  [NodeType.GOOGLE_FORM_TRIGGER]:  googleFormTriggerExecutor,
  [NodeType.STRIPE_TRIGGER]:       stripeTriggerExecutor,
  [NodeType.ANTHROPIC]:            anthropicExecutor,
  [NodeType.GEMINI]:               geminiExecutor,
  [NodeType.OPENAI]:               openAiExecutor,
  [NodeType.DISCORD]:              discordExecutor,
  [NodeType.SLACK]:                slackExecutor,
}
```

---

## 6. Individual Executor Behaviors

### manualTriggerExecutor
- Publishes loading → success.
- Returns context unchanged (pass-through).

### googleFormTriggerExecutor
- Publishes loading → success.
- Returns context unchanged (data already injected as `initialData.googleForm`).

### stripeTriggerExecutor
- Same as Google Form — pass-through of pre-injected `initialData.stripe` context.

### httpRequestExecutor
- Resolves endpoint and body templates via Handlebars against current context.
- Makes HTTP request using `ky`.
- Validates JSON body for POST/PUT/PATCH.
- Stores response under `data.variableName` as `{ httpResponse: { status, statusText, data } }`.

### anthropicExecutor
- Resolves system/user prompts via Handlebars.
- Fetches and decrypts credential from database.
- Calls `generateText` via AI SDK with `claude-sonnet-4-5`.
- Stores result as `{ text: string }` under `data.variableName`.

### geminiExecutor
- Same pattern as Anthropic.
- Uses `gemini-2.0-flash` via `@ai-sdk/google`.

### openAiExecutor
- Resolves prompts via Handlebars (handles legacy `{{FORM_SUBMISSION_DATA}}` placeholder).
- Fetches and decrypts credential.
- Calls `generateDiscordAiOutput()` with `gpt-4o-mini` (structured) / `gpt-4` (fallback).
- Stores a structured `AiNodeOutput` under `data.variableName`.

### discordExecutor
- Resolves the AI source variable: reads `data.aiSourceVariable` from context or falls back to legacy `data.content` Handlebars template.
- Validates AI output is a proper AI node result.
- Extracts Discord message content from AI output.
- Posts to Discord webhook via `sendDiscordWebhook()`.
- Stores `{ messageContent: string }` under `data.variableName`.

### slackExecutor
- Compiles `data.content` Handlebars template against context.
- POSTs to Slack webhook URL via `ky`.
- Stores `{ messageContent: string }` under `data.variableName`.

---

## 7. Real-time Status Publication

`publishNodeStatus(publish, workflowId, nodeId, nodeType, status)`:
1. Updates `WorkflowExecutionSnapshot` in the database (for polling fallback).
2. Publishes an event to the Inngest Realtime channel for that workflow.

The Inngest channel `workflow-execution:{workflowId}` has a single topic `status` with this schema:
```ts
{
  workflowId: string;
  nodeId?: string;
  nodeType?: string;
  status?: "loading" | "success" | "error";
  phase: "execution.started" | "execution.completed" | "node.started" | "node.completed" | "node.failed";
}
```

---

## 8. Trigger Enforcement

`lib/triggers/enforcement.ts` provides:

- `assertTriggerEnabled(kind)` — queries `TriggerSetting` by primary key; throws `TriggerDisabledError` if disabled. Defaults to `enabled: true` if no row exists.
- `assertWorkflowTriggersEnabled(nodeTypes[])` — extracts trigger kinds from node types and asserts each is enabled.
- `TriggerDisabledError` — custom error class carrying the `triggerKind`.

Enforcement is applied at two points:
1. **Before dispatching to Inngest**: `sendWorkflowExecution` calls `assertTriggerEnabled(triggerKind)`.
2. **Inside the Inngest function**: `assertWorkflowTriggersEnabled(nodeTypes)` called in the `prepare-workflow` step.

---

## 9. Credential Encryption

`lib/encryption.ts` wraps `Cryptr` with lazy initialization:
- `encrypt(text: string) → string` — AES-encrypt plaintext, returns ciphertext string.
- `decrypt(text: string) → string` — Decrypts ciphertext.
- Key source: `process.env.ENCRYPTION_KEY` (required; throws on missing).
- Encryption used at: `credentialsRouter.create` and `credentialsRouter.update`.
- Decryption used at: AI node executors (Anthropic, Gemini, OpenAI) at execution time inside Inngest.

---

## 10. Background Jobs (Inngest)

### Inngest Client (`inngest/client.ts`)
```ts
export const inngest = new Inngest({ id: "flowforge" });
```

### Inngest Handler (`app/api/inngest/route.ts`)
Registers the `executeWorkflow` function with the Inngest platform via `serve()`.

### Inngest Dev Server
- Run locally with `pnpm dev:inngest`.
- UI: `http://localhost:8288` — view function runs, step traces, replay events.

---

## 11. Google Form Workflow Resolution

When a Google Form webhook arrives, `lib/resolve-google-form-workflow.ts` resolves which workflow to execute:

1. **URL match**: If the `workflowId` from the URL has a GOOGLE_FORM_TRIGGER node, use it.
   - If the node has a stored `formId` that doesn't match the incoming `formId`, reject with 400.
2. **Form ID match**: If the URL workflow has no trigger node, search all of the user's GOOGLE_FORM_TRIGGER nodes for one claiming the incoming `formId`.
3. **Single fallback**: If exactly one GOOGLE_FORM_TRIGGER node exists for the user, use it regardless.
4. **Error**: Otherwise return 400 with guidance on configuration.

`claimGoogleFormId(userId, triggerNodeId, formId, existingData)`: When a user saves a Form ID in the trigger node settings:
- Releases the `formId` from any other trigger node that was claiming it.
- Sets `formId` and `formIdClaimedAt` on the target node.

---

## 12. Error Handling

| Location | Strategy |
|---|---|
| Inngest executors | `NonRetriableError` for configuration/data errors; plain `Error` for transient |
| Inngest `onFailure` | Updates `Execution.status = FAILED`, records message + stack |
| tRPC procedures | `TRPCError` with appropriate codes (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST) |
| Webhook handlers | Returns `{ success, error }` JSON; maps `TriggerDisabledError` → 403, others → 500 |
| Admin service | `TRPCError` for business rule violations (last admin, self-deletion) |

---

## 13. Logging

`lib/logger.ts` provides a structured logger with methods: `info`, `warn`, `error`.

Key log events emitted:
| Event | Location |
|---|---|
| `admin.user.role_updated` | `adminUserService.setUserRole` |
| `admin.user.deleted` | `adminUserService.deleteUser` |
| `admin.triggers.updated` | `triggerSettingsService.updateSettings` |
| `discord.ai_output.validated` | `discordExecutor` |
| `openai.structured_output.fallback` | `openAiExecutor` |
| `trigger.execution.blocked` | `enforcement.assertTriggerEnabled` |
