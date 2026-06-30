# System Overview

## Product Purpose

FlowForge is a visual workflow automation platform. It lets users compose pipelines from a library of pre-built nodes on a drag-and-drop canvas, configure each node, then execute the pipeline on demand or via external event triggers. The product targets developers and technical users who need to automate data-routing tasks without writing full-stack code for every integration.

The platform is positioned as a self-hosted, customizable alternative to services like Zapier or n8n.

---

## Core Business Domain

The central concept is the **workflow**: a directed acyclic graph (DAG) of **nodes** connected by **edges**. When a workflow is executed:

1. The trigger node fires and injects initial data into the execution context.
2. Each subsequent node reads the shared context, performs its action, and writes its output back into context under a user-defined variable name.
3. Execution follows the topological order of the node graph.
4. The final context state becomes the execution output, persisted to the database.

---

## Key User Journeys

### 1. Sign Up and Subscribe
- User registers with email and password.
- User is redirected to the dashboard.
- User upgrades to Pro via Polar.sh checkout to unlock workflow creation and credential storage.

### 2. Build a Workflow
- User creates a workflow (generates a random slug name, places an INITIAL node automatically).
- User opens the visual editor.
- User adds nodes (trigger, AI, HTTP, messaging) from the node palette.
- User connects nodes by dragging edges between handles.
- User configures each node via a settings dialog (prompts, credential selection, variable names).
- User saves the workflow (canvas state persisted via tRPC mutation).

### 3. Execute a Workflow Manually
- From the editor, the user clicks **Execute**.
- The workflow is submitted to Inngest as a durable background function.
- Real-time status updates flow back to the canvas via Inngest Realtime channels.
- Node cards show loading/success/error states during execution.
- Completed execution details (output, status, timing) are viewable in the Executions list.

### 4. Trigger from Google Forms
- User adds a `GOOGLE_FORM_TRIGGER` node and configures a Google Form ID.
- User copies the webhook URL from the node settings.
- User sets up a Google Forms Apps Script (or similar) to POST to that webhook on form submission.
- When the form is submitted, FlowForge receives the payload, resolves the target workflow, and fires execution.

### 5. Trigger from Stripe
- User adds a `STRIPE_TRIGGER` node to a workflow.
- User configures the webhook URL in the Stripe dashboard.
- When Stripe fires the event, FlowForge receives it and runs the workflow with Stripe event data in context.

### 6. Manage API Credentials
- User creates a credential (type: OPENAI / ANTHROPIC / GEMINI / DISCORD / SLACK) and pastes an API key.
- The key is encrypted at rest with AES via Cryptr.
- When building a workflow, users select a stored credential for AI and messaging nodes.
- Credentials are decrypted only inside the Inngest execution environment at runtime.

---

## Major Features

| Feature | Description |
|---|---|
| Visual Workflow Editor | React Flow canvas with node palette, edge connections, snap-to-grid |
| Manual Execution | One-click workflow run from the editor |
| Google Form Webhook Trigger | Workflows triggered by Google Form submissions via HTTP webhook |
| Stripe Webhook Trigger | Workflows triggered by Stripe payment events |
| OpenAI Integration | Structured AI output (gpt-4o-mini) with gpt-4 fallback |
| Anthropic Integration | Claude Sonnet text generation |
| Gemini Integration | Google Gemini 2.0 Flash text generation |
| Discord Integration | Post AI-generated content to Discord channels via webhook |
| Slack Integration | Post templated messages to Slack via incoming webhook |
| HTTP Request Node | Arbitrary HTTP calls (GET/POST/PUT/PATCH/DELETE) with Handlebars templating |
| Encrypted Credentials | Per-user API key vault with AES encryption |
| Real-time Execution Status | Live node status on canvas via WebSocket (Inngest Realtime) + polling fallback |
| Execution History | Paginated log of all past executions with status and output |
| Subscription Gate | Workflow and credential creation requires an active Polar.sh Pro subscription |
| Admin Panel | User management, role assignment, and per-trigger-type kill switches |

---

## High-Level Architecture

FlowForge is a **full-stack Next.js 16 application** (App Router) backed by PostgreSQL. There is no separate backend service for the core product — server-side logic runs as Next.js Route Handlers and Server Actions.

```
Browser  ──────►  Next.js App (frontend/)
                       │
           ┌───────────┼───────────────────┐
           │           │                   │
        tRPC API    REST Webhooks     Inngest API
        /api/trpc   /api/webhooks     /api/inngest
           │           │                   │
           └───────────┴─────────┐         │
                                 ▼         ▼
                           PostgreSQL   Inngest Cloud
                           (Prisma)     (Durable Functions
                                         + Realtime)
```

### Core Layers

| Layer | Technology | Responsibility |
|---|---|---|
| UI | React 19, @xyflow/react, shadcn/ui | Visual editor, dashboards, forms |
| State | Jotai, TanStack Query, nuqs | Client state, server cache, URL params |
| API | tRPC v11 | Type-safe RPC for all CRUD operations |
| Auth | better-auth | Session management, roles, Polar.sh integration |
| Background Jobs | Inngest | Durable workflow execution, retries, telemetry |
| Realtime | Inngest Realtime | WebSocket push of execution events to browser |
| Database | PostgreSQL + Prisma | All persistent state |
| Payments | Polar.sh | Subscription management, customer portal |
| Encryption | Cryptr | Symmetric encryption for stored API keys |

---

## Core Workflows

### Workflow Execution (End-to-End)

```
User/Webhook ──► sendWorkflowExecution()
                      │
              assertTriggerEnabled()  ──► TriggerSetting DB check
                      │
               inngest.send(event)
                      │
              ┌───────▼───────────────────────┐
              │  Inngest: execute-workflow fn  │
              │  1. Create Execution record    │
              │  2. Load workflow + nodes      │
              │  3. Topological sort           │
              │  4. Publish execution.started  │
              │  5. For each node:             │
              │     a. getExecutor(nodeType)   │
              │     b. executor(context)       │
              │     c. context = output        │
              │  6. Publish execution.completed│
              │  7. Update Execution record    │
              └───────────────────────────────┘
                      │
              WorkflowExecutionSubscriber (browser)
              receives events via Inngest Realtime
```

### Authentication Flow

```
User ──► POST /api/auth/sign-in ──► better-auth
                                         │
                                   verify email+password
                                         │
                                   create Session record
                                         │
                                   Set HTTP-only session cookie
                                         │
                                   Redirect to /workflows
```

See [System Design Document](./system-design.md) for detailed sequence diagrams and architectural decisions.
