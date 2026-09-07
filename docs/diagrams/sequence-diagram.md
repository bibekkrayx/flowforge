# Sequence Diagrams

## 1. User Authentication (Email/Password)

```mermaid
sequenceDiagram
    participant Browser
    participant NextJS as Next.js App
    participant BetterAuth as better-auth
    participant DB as PostgreSQL

    Browser->>NextJS: POST /api/auth/sign-in/email<br/>{email, password}
    NextJS->>BetterAuth: handle sign-in
    BetterAuth->>DB: SELECT account WHERE identifier=email AND providerId='credential'
    DB-->>BetterAuth: account with hashed password
    BetterAuth->>BetterAuth: verify password hash
    BetterAuth->>DB: INSERT session {token, userId, expiresAt}
    DB-->>BetterAuth: session created
    BetterAuth-->>NextJS: user + session
    NextJS-->>Browser: 200 OK + Set-Cookie: session=<token>
    Browser->>Browser: navigate to /workflows
```

---

## 2. Manual Workflow Execution

```mermaid
sequenceDiagram
    participant Browser
    participant TRPC as tRPC /api/trpc
    participant Inngest as Inngest Cloud
    participant DB as PostgreSQL
    participant Executors as Node Executors
    participant Discord as Discord API

    Browser->>TRPC: workflows.execute.mutate({id})
    TRPC->>DB: assertTriggerEnabled(MANUAL)
    DB-->>TRPC: enabled=true
    TRPC->>Inngest: inngest.send(workflows/execute.workflow, {workflowId})
    Inngest-->>TRPC: event queued (id: cuid)
    TRPC-->>Browser: 200 OK (returns workflow)

    Note over Inngest,DB: Asynchronous execution begins
    Inngest->>DB: INSERT execution {workflowId, inngestEventId, status=RUNNING}
    Inngest->>DB: SELECT workflow + nodes + connections
    DB-->>Inngest: workflow data

    Inngest->>Inngest: topologicalSort(nodes, connections)

    Inngest->>DB: UPSERT WorkflowExecutionSnapshot {phase=running}
    Inngest->>Inngest: publish "execution.started" to channel

    loop For each node in sorted order
        Inngest->>DB: UPSERT snapshot {nodeId: loading}
        Inngest->>Inngest: publish "node.started"
        Inngest->>Executors: executor(context)
        Executors->>DB: SELECT credential (if AI node)
        DB-->>Executors: encrypted credential
        Executors->>Discord: POST webhook (if Discord node)
        Discord-->>Executors: 204 No Content
        Executors-->>Inngest: updated context
        Inngest->>DB: UPSERT snapshot {nodeId: success}
        Inngest->>Inngest: publish "node.completed"
    end

    Inngest->>DB: UPSERT snapshot {phase=completed}
    Inngest->>Inngest: publish "execution.completed"
    Inngest->>DB: UPDATE execution {status=SUCCESS, output=context, completedAt}

    Note over Browser,Inngest: Realtime status updates
    Browser->>Inngest: WebSocket subscription (useRealtime)
    Inngest-->>Browser: "node.started" event → canvas shows loading spinner
    Inngest-->>Browser: "node.completed" event → canvas shows green check
    Inngest-->>Browser: "execution.completed" → reset status
```

---

## 3. Google Form Webhook Trigger

```mermaid
sequenceDiagram
    participant GoogleForms as Google Forms<br/>(Apps Script)
    participant Webhook as /api/webhooks/google-form
    participant Inngest as Inngest Cloud
    participant DB as PostgreSQL

    GoogleForms->>Webhook: POST ?workflowId=xxx<br/>{formId, responses, ...}
    Webhook->>DB: assertTriggerEnabled(GOOGLE_FORM)
    DB-->>Webhook: enabled=true
    Webhook->>DB: resolveGoogleFormWorkflow(workflowId, formId)
    DB-->>Webhook: resolved workflow
    Webhook->>Inngest: inngest.send(workflows/execute.workflow,<br/>{workflowId, initialData: {googleForm: ...}})
    Inngest-->>Webhook: queued
    Webhook-->>GoogleForms: 200 {success: true}

    Note over Inngest,DB: Execution proceeds as in Manual flow above
```

---

## 4. Credential Creation (Pro User)

```mermaid
sequenceDiagram
    participant Browser
    participant TRPC as tRPC
    participant Polar as Polar.sh API
    participant Cryptr as Cryptr (in-process)
    participant DB as PostgreSQL

    Browser->>TRPC: credentials.create.mutate({name, type, value})
    TRPC->>TRPC: protectedProcedure: getSession()
    TRPC->>Polar: getStateExternal({externalId: userId})
    Polar-->>TRPC: {activeSubscriptions: [...]}
    TRPC->>Cryptr: encrypt(value)
    Cryptr-->>TRPC: ciphertext
    TRPC->>DB: INSERT credential {name, type, value=ciphertext, userId}
    DB-->>TRPC: credential record
    TRPC-->>Browser: credential (ciphertext value)
```

---

## 5. Admin Role Change

```mermaid
sequenceDiagram
    participant Admin as Admin Browser
    participant TRPC as tRPC
    participant AdminSvc as adminUserService
    participant AdminRepo as adminUserRepository
    participant BetterAuth as better-auth API
    participant DB as PostgreSQL

    Admin->>TRPC: admin.users.setRole.mutate({userId, role: "ADMIN"})
    TRPC->>TRPC: adminProcedure: check session + ADMIN role
    TRPC->>AdminSvc: setUserRole(actorId, {userId, role})
    AdminSvc->>AdminRepo: findById(userId)
    DB-->>AdminSvc: target user
    AdminSvc->>AdminSvc: guard: can't demote self
    AdminSvc->>AdminRepo: countByRole(ADMIN)
    DB-->>AdminSvc: adminCount
    AdminSvc->>AdminSvc: guard: last admin check
    AdminSvc->>BetterAuth: auth.api.setRole({userId, role})
    BetterAuth->>DB: UPDATE user SET role="ADMIN"
    DB-->>BetterAuth: updated
    BetterAuth-->>AdminSvc: done
    AdminSvc-->>TRPC: {success: true}
    TRPC-->>Admin: {success: true}
```
