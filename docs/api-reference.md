# API Reference

All API surfaces are served by the Next.js application. Base URL: `http://localhost:3000` (development).

---

## 1. tRPC API

**Endpoint**: `POST /api/trpc/[procedure]`  
**Serialization**: superjson  
**Auth**: Session cookie (set by better-auth)

### Procedure Naming Convention
Procedures are accessed as `{router}.{procedure}` (e.g., `workflows.create`, `admin.users.list`).

---

### `workflows.create`
**Type**: Mutation  
**Auth**: Premium (session + active subscription)  
**Input**: None  
**Response**: Workflow object  
**Description**: Creates a new workflow with a random 3-word slug name and one INITIAL node at position `{ x: 0, y: 0 }`.

**Response shape**:
```ts
{
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### `workflows.remove`
**Type**: Mutation  
**Auth**: Protected  
**Input**:
```ts
{ id: string }
```
**Description**: Deletes a workflow by ID. Only deletes if the authenticated user owns it. Cascades to nodes, connections, executions, and execution snapshot.

---

### `workflows.updateName`
**Type**: Mutation  
**Auth**: Protected  
**Input**:
```ts
{ id: string; newName: string }  // newName: min length 1
```
**Description**: Renames a workflow.

---

### `workflows.update`
**Type**: Mutation  
**Auth**: Protected  
**Input**:
```ts
{
  id: string;
  nodes: Array<{
    id: string;
    type?: string | null;
    position: { x: number; y: number };
    data?: Record<string, any>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>;
}
```
**Description**: Saves the full canvas state. Runs in a Prisma transaction:
1. Deletes all existing connections for the workflow.
2. Deletes all existing nodes for the workflow.
3. Creates new nodes (batch).
4. Creates new connections (deduplicated batch).
5. Updates `workflow.updatedAt`.

---

### `workflows.updateGoogleFormTrigger`
**Type**: Mutation  
**Auth**: Protected  
**Input**:
```ts
{
  workflowId: string;
  nodeId: string;
  formId: string;  // min length 1
}
```
**Description**: Claims a Google Form ID for a `GOOGLE_FORM_TRIGGER` node. Releases the form ID from any other trigger nodes that were claiming it, then saves it on the target node with a timestamp.

---

### `workflows.execute`
**Type**: Mutation  
**Auth**: Protected  
**Input**:
```ts
{ id: string }
```
**Response**: Workflow object  
**Errors**:
- `FORBIDDEN` — Manual trigger is disabled platform-wide.
**Description**: Fires the `workflows/execute.workflow` Inngest event to begin workflow execution. Returns immediately; execution is asynchronous.

---

### `workflows.getOne`
**Type**: Query  
**Auth**: Protected  
**Input**:
```ts
{ id: string }
```
**Response**:
```ts
{
  id: string;
  name: string;
  nodes: Array<{          // React Flow Node format
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges: Array<{          // React Flow Edge format
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
  }>;
}
```

---

### `workflows.getMany`
**Type**: Query  
**Auth**: Protected  
**Input**:
```ts
{
  page?: number;        // default: 1
  pageSize?: number;    // default: 5, min: 1, max: 100
  search?: string;      // default: "", case-insensitive name filter
}
```
**Response**:
```ts
{
  items: Workflow[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hadPreviousPage: boolean;
}
```

---

### `credentials.create`
**Type**: Mutation  
**Auth**: Premium  
**Input**:
```ts
{
  name: string;         // min length 1
  type: CredentialType; // "OPENAI" | "ANTHROPIC" | "GEMINI" | "DISCORD" | "SLACK"
  value: string;        // min length 1 (plaintext API key, will be encrypted)
}
```
**Description**: Creates a new credential. The `value` is AES-encrypted before storage.

---

### `credentials.remove`
**Type**: Mutation  
**Auth**: Protected  
**Input**:
```ts
{ id: string }
```
**Description**: Deletes a credential. Only deletes if the user owns it.

---

### `credentials.update`
**Type**: Mutation  
**Auth**: Protected  
**Input**:
```ts
{
  id: string;
  name: string;
  type: CredentialType;
  value: string;        // plaintext API key, will be re-encrypted
}
```
**Description**: Updates name, type, and re-encrypts the new value.

---

### `credentials.getOne`
**Type**: Query  
**Auth**: Protected  
**Input**:
```ts
{ id: string }
```
**Response**: Credential object (note: `value` is the encrypted ciphertext, never plaintext).

---

### `credentials.getMany`
**Type**: Query  
**Auth**: Protected  
**Input**:
```ts
{
  page?: number;
  pageSize?: number;
  search?: string;
}
```
**Response**: Paginated credential list (same pagination shape as `workflows.getMany`).

---

### `credentials.getByType`
**Type**: Query  
**Auth**: Protected  
**Input**:
```ts
{ type: CredentialType }
```
**Response**: `Credential[]` ordered by `updatedAt` descending.

---

### `executions.getOne`
**Type**: Query  
**Auth**: Protected  
**Input**:
```ts
{ id: string }
```
**Response**:
```ts
{
  id: string;
  workflowId: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  error: string | null;
  errorStack: string | null;
  startedAt: Date;
  completedAt: Date | null;
  inngestEventId: string;
  output: unknown;
  workflow: { id: string; name: string };
}
```

---

### `executions.getMany`
**Type**: Query  
**Auth**: Protected  
**Input**:
```ts
{
  page?: number;
  pageSize?: number;
}
```
**Response**: Paginated list of executions (newest first). Each item includes `workflow: { id, name }`.

---

### `admin.users.list`
**Type**: Query  
**Auth**: Admin  
**Input**:
```ts
{
  page?: number;
  pageSize?: number;
  search?: string;
}
```
**Response**: Paginated user list with role and account status.

---

### `admin.users.setRole`
**Type**: Mutation  
**Auth**: Admin  
**Input**:
```ts
{
  userId: string;
  role: "USER" | "ADMIN";
}
```
**Errors**:
- `NOT_FOUND` — User not found.
- `BAD_REQUEST` — Actor tried to remove their own admin access.
- `BAD_REQUEST` — Would remove the last admin.

---

### `admin.users.delete`
**Type**: Mutation  
**Auth**: Admin  
**Input**:
```ts
{ userId: string }
```
**Errors**:
- `BAD_REQUEST` — Actor tried to delete their own account.
- `NOT_FOUND` — User not found.
- `BAD_REQUEST` — Would remove the last admin.

---

### `admin.triggers.list`
**Type**: Query  
**Auth**: Admin  
**Response**:
```ts
Array<{
  kind: "MANUAL" | "GOOGLE_FORM" | "STRIPE";
  enabled: boolean;
  updatedAt: Date;
}>
```

---

### `admin.triggers.update`
**Type**: Mutation  
**Auth**: Admin  
**Input**:
```ts
{
  settings: Array<{
    kind: "MANUAL" | "GOOGLE_FORM" | "STRIPE";
    enabled: boolean;
  }>;
}
```
**Description**: Bulk upserts trigger settings. Missing trigger kinds default to `enabled: true` in application code.

---

## 2. better-auth REST Endpoints

**Handled by**: `app/api/auth/[...all]/route.ts`  
All endpoints are at `/api/auth/*`.

### `POST /api/auth/sign-up/email`
**Body**:
```ts
{ email: string; password: string; name?: string }
```
**Response**: User object + session cookie.

### `POST /api/auth/sign-in/email`
**Body**:
```ts
{ email: string; password: string }
```
**Response**: Session cookie set.

### `POST /api/auth/sign-out`
**Response**: Clears session cookie.

### `GET /api/auth/get-session`
**Response**:
```ts
{
  user: {
    id: string; email: string; name: string | null;
    role: "USER" | "ADMIN"; emailVerified: boolean;
    image: string | null; banned: boolean;
  };
  session: { id: string; expiresAt: Date; token: string; ... };
} | null
```

### Polar.sh checkout (via better-auth Polar plugin)
Handled automatically by the `polar` plugin. Called via `authClient.checkout({ slug: "pro" })` from the client.

### Polar.sh customer portal
Called via `authClient.customer.portal()` from the client.

---

## 3. Webhook Endpoints

### `POST /api/webhooks/google-form`

**Query params**: `workflowId` (required)  
**Auth**: None (⚠️ no signature verification)  
**Content-Type**: `application/json`

**Request body**:
```ts
{
  formId?: string;
  formTitle?: string;
  responseId?: string;
  timestamp?: string;
  respondentEmail?: string;
  responses?: unknown;
  // ...any additional fields (stored in raw)
}
```

**Success response** (HTTP 200):
```ts
{ success: true }
```

**Error responses**:
- `400` — Missing `workflowId` query param.
- `403` — Google Form trigger disabled by admin.
- `500` — Internal error processing the submission.

**Behavior**: Resolves the target workflow via form ID matching logic, then fires an Inngest event with `initialData.googleForm` containing the form data.

---

### `POST /api/webhooks/stripe`

**Query params**: `workflowId` (required)  
**Auth**: None (⚠️ no signature verification)  
**Content-Type**: `application/json`

**Request body**: Standard Stripe event object.

**Success response** (HTTP 200):
```ts
{ success: true }
```

**Error responses**:
- `400` — Missing `workflowId`.
- `403` — Stripe trigger disabled by admin.
- `500` — Internal error.

**Data injected into context as `initialData.stripe`**:
```ts
{
  eventId: string;    // Stripe event ID
  eventType: string;  // e.g. "payment_intent.succeeded"
  timestamp: number;  // Unix timestamp
  livemode: boolean;
  raw: object;        // Stripe event data.object
}
```

---

## 4. REST Endpoints (Internal)

### `GET /api/workflows/[workflowId]/execution-status`

**Auth**: None (public, but requires knowing the workflowId)  
**Purpose**: Polling fallback for real-time execution status when WebSocket is unavailable.

**Response**:
```ts
{
  workflowId: string;
  phase: "idle" | "running" | "completed" | "failed";
  nodeStatuses: Record<
    string,   // nodeId
    { status: "loading" | "success" | "error"; nodeType?: string }
  >;
  updatedAt: number;   // Unix timestamp (ms)
}
```

---

### `POST /api/inngest`

Inngest function registration and event handler. Managed entirely by the Inngest SDK. Do not call this endpoint directly.

---

### `POST /api/create-task`

**Status**: Development/demo endpoint. Sends a stub `app/task.created` Inngest event.  
**Response**:
```ts
{ message: "Event sent" }
```

---

## 5. Server Actions

### `fetchWorkflowExecutionToken(workflowId: string)`

**Location**: `features/execution/actions/fetch-workflow-execution-token.ts`  
**Type**: `"use server"` action  
**Description**: Returns a signed Inngest Realtime subscription token for the workflow's execution channel. Called by `WorkflowExecutionSubscriber` before subscribing via `useRealtime()`.

**Returns**: Inngest client subscription token (opaque string).

---

## 6. Error Codes

### tRPC Error Codes

| Code | HTTP Equivalent | When Used |
|---|---|---|
| `UNAUTHORIZED` | 401 | No session cookie or invalid session |
| `FORBIDDEN` | 403 | No active subscription (premium), not admin role, trigger disabled |
| `NOT_FOUND` | 404 | Record not found or user doesn't own it |
| `BAD_REQUEST` | 400 | Business rule violation (last admin, invalid input) |

### Webhook Error Responses

| HTTP Status | Cause |
|---|---|
| 400 | Missing required query parameters |
| 403 | Trigger kind disabled by admin |
| 500 | Unexpected server error |
