# FlowForge — Product Requirements

FlowForge is a visual workflow automation builder: users compose workflows on a
drag-and-drop canvas (React Flow), each starting from a **trigger** node and
chaining together action nodes (HTTP requests, AI models, messaging, email,
spreadsheets, loops, etc.). Runs are executed durably by Inngest against a
shared execution engine.

FlowForge targets developers and technical users who want a self-hosted,
customizable alternative to Zapier or n8n.

---

## Personas

| Persona | Goal | Primary flows |
| --- | --- | --- |
| **Builder** | Automate a recurring task without writing a full integration stack | Create workflow → configure nodes → save → execute |
| **Integrator** | Connect external events (forms, payments, schedules, calendar) to downstream actions | Pick a trigger → wire webhook or schedule → chain actions |
| **Pro subscriber** | Create and maintain multiple workflows with stored API keys | Subscribe → create credentials → build and run workflows |
| **Admin** | Operate the platform and pause risky trigger kinds globally | Admin panel → user roles → trigger kill switches |

---

## Core concepts

- **Workflow** — A directed acyclic graph (DAG) of nodes and edges owned by a
  user. Persisted in PostgreSQL; edited on the canvas at `/workflows/[id]`.
- **Trigger** — The single entry node that starts a run and injects initial
  context for downstream nodes.
- **Action node** — Performs work (HTTP call, AI generation, message send, etc.)
  and writes output into a user-defined context variable.
- **Context** — A shared key/value bag passed through execution. Nodes read
  prior outputs via Handlebars templates (e.g. `{{myAiVar.text}}`).
- **Credential** — An encrypted API key vault entry selected by nodes that
  require authentication (AI providers, Resend, Google Sheets).

---

## Triggers

Every workflow has exactly one trigger. FlowForge supports five trigger kinds:

- **Manual** — run on demand from the editor or an API call.
- **Google Form** — run on an inbound Google Form submission webhook.
- **Stripe** — run on an inbound Stripe event webhook.
- **Schedule** — run automatically on a recurring cron/interval schedule.
- **Event Reminder** — run relative to a user calendar event (before or after).

Each kind has a global kill switch in the [Admin panel](./features/admin-panel.md).
When disabled, no workflow using that trigger executes.

### Manual trigger

Runs on demand from the **Execute** button or an explicit API call. Injects no
trigger-specific context. New workflows start with a Manual trigger so they can
be tested immediately.

### Google Form trigger

Starts a workflow when a linked Google Form receives a submission. Injects
`context.googleForm` (respondent email, per-question responses, raw payload).
Users copy a webhook URL from node settings into a Google Apps Script or similar.

### Stripe trigger

Starts a workflow when a Stripe event arrives via webhook. Injects
`context.stripe` (event type, amount, currency, customer ID, raw event).

### Schedule trigger

Runs a workflow on a recurring schedule such as *"Every day at 9:00 AM"* or
*"Every 15 minutes"*.

- **Modes:** *Simple* (interval presets: every 5m / 15m / 30m / 1h / 1d) and
  *Advanced* (a raw 5-field cron expression plus an IANA timezone).
- **Execution:** a recurring `scheduler-scan` job runs every minute, checks the
  global Schedule kill switch, finds due schedules, atomically claims each one,
  and dispatches it through the existing execution engine. See
  [Workflow execution](./features/workflow-execution.md#scheduled-execution).
- **Context:** scheduled runs expose `{{schedule.executedAt}}`,
  `{{schedule.timezone}}`, and `{{schedule.cronExpression}}` to downstream nodes.
- **Constraints:** at most one Schedule trigger per workflow; a Schedule-only
  workflow is valid and does not need a Manual trigger.
- **Reliability:** duplicate runs are prevented by an atomic compare-and-swap on
  `nextRunAt`; missed runs self-heal on the next scan; failures are recorded like
  any execution.

### Event Reminder trigger

Runs a workflow at a computed time relative to a **calendar event** the user
owns (e.g. *"1 day before meeting start"* or *"30 minutes after event end"*).

- **Configuration:** pick a calendar event, offset value, offset unit
  (minutes / hours / days), and direction (before / after). Saving materializes
  an `EventReminder` row with a computed `fireAt`.
- **Execution:** a recurring `reminder-scan` job finds due reminders, atomically
  claims each one (compare-and-swap on `triggeredAt`), and dispatches through
  the shared execution engine with `triggerKind: EVENT`.
- **Context:** injects `context.event` with `id`, `title`, `description`,
  `startAt`, `endAt`, `allDay`, and `timezone`.
- **Constraints:** at most one Event Reminder trigger per workflow; requires
  the user to have created calendar events in FlowForge.
- **Reliability:** same self-healing and duplicate-prevention pattern as
  Schedule triggers.

### Trigger feature matrix

| Capability | Manual | Google Form | Stripe | Schedule | Event Reminder |
| --- | --- | --- | --- | --- | --- |
| Trigger kind | `MANUAL` | `GOOGLE_FORM` | `STRIPE` | `SCHEDULE` | `EVENT` |
| Node type | `MANUAL_TRIGGER` | `GOOGLE_FORM_TRIGGER` | `STRIPE_TRIGGER` | `SCHEDULE_TRIGGER` | `EVENT_TRIGGER` |
| Started by | User / API | Inbound webhook | Inbound webhook | Recurring `scheduler-scan` | Recurring `reminder-scan` |
| Injects `context` | — | `context.googleForm` | `context.stripe` | `context.schedule` | `context.event` |
| Global kill switch | Yes | Yes | Yes | Yes | Yes |
| Reuses execution engine | Yes | Yes | Yes | Yes | Yes |
| One-per-workflow limit | — | — | — | Yes | Yes |

See [Triggers](./features/triggers.md) for template variables and setup detail.

---

## Action nodes

Action nodes run after the trigger in topological order. Each stores output under
a user-defined `variableName` for downstream Handlebars templates.

| Node type | Label | Purpose | Credential |
| --- | --- | --- | --- |
| `HTTP_REQUEST` | HTTP Request | Arbitrary outbound HTTP (GET/POST/PUT/PATCH/DELETE) with templated URL and body | — |
| `OPENAI` | OpenAI | Structured AI output (`gpt-4o-mini`, `gpt-4` fallback) | `OPENAI` |
| `ANTHROPIC` | Anthropic | Claude text generation | `ANTHROPIC` |
| `GEMINI` | Gemini | Google Gemini text generation | `GEMINI` |
| `DISCORD` | Discord | Post a message to a Discord channel via incoming webhook | — (webhook URL in node) |
| `SLACK` | Slack | Post a message to Slack via incoming webhook | — (webhook URL in node) |
| `EMAIL` | Email | Send transactional email via Resend | `RESEND` |
| `GOOGLE_SHEETS` | Google Sheets | Read rows from a spreadsheet worksheet | `GOOGLE_SHEETS` |
| `LOOP` | Loop / For Each | Run downstream nodes once per item in an array | — |

### Loop / For Each

The Loop node iterates over an array resolved from the workflow context
(`sourcePath`). For each item it exposes an `itemVariableName` to the loop body,
runs all downstream nodes with an isolated context copy, and collects results
under `variableName`. Supports `continueOnError` for per-item failure tolerance.
Nested loops are supported.

See [Integrations](./features/integrations.md) for per-node configuration and
output shapes.

---

## AI workflow generation

Pro subscribers can describe an automation in natural language and have FlowForge
propose a workflow plan before creating it on the canvas.

### User flow

1. User opens **Create workflow** and chooses the AI path.
2. User describes the desired automation in a text prompt.
3. **Planner** (`aiWorkflow.plan`) calls an LLM with a live capability snapshot
   derived from `config/node-type-metadata.ts` — only registered node types,
   credential types, and connection rules are exposed to the model.
4. User reviews the structured plan (steps, explanation, unsupported features).
5. If `possible: true`, user confirms → **Generate** (`aiWorkflow.generate`)
   converts the plan to a React Flow graph, validates it, and persists a new
   workflow.
6. User lands in the editor with nodes pre-placed; a **Setup Guide** panel
   highlights remaining manual configuration (webhook URLs, form IDs, API keys).

### Product rules

- The planner must never invent node types not in the catalog. Unsupported
  requests return `possible: false` with a reason and suggestions (e.g. use
  HTTP Request as a fallback).
- The planner does not save or execute anything — it only produces a plan.
- External configuration (webhook URLs, credentials, form IDs) is always left
  for the user to complete after generation.

---

## Workflow editor

- **Canvas:** React Flow with snap-to-grid, dark theme, minimap, and pan-on-scroll.
- **Node picker:** grouped into **Triggers** and **Actions**, backed by
  `node-type-metadata.ts` as the single source of display labels and descriptions.
  Accessible from the header **Add node** button and the canvas **+** control.
- **Configuration:** each node opens a settings dialog (react-hook-form + Zod).
  Changes are held in local canvas state until **Save**.
- **Save:** replaces all nodes and connections for the workflow in a transaction.
- **Execute:** shown when a Manual trigger (or legacy INITIAL node) is present;
  submits the run to Inngest and streams realtime node status to the canvas.
- **Setup Guide:** contextual checklist for webhook and credential setup on
  AI-generated or manually built workflows.

See [Workflow Editor](./features/workflow-editor.md).

---

## Execution and observability

- All trigger kinds dispatch into a single `execute-workflow` Inngest function.
- Nodes run in topological order; cycles are rejected with a clear error.
- Each node publishes loading / success / error status via Inngest Realtime
  (with a polling fallback).
- Completed runs are recorded in execution history with status, timing, and
  output context.

See [Workflow Execution](./features/workflow-execution.md).

---

## Credentials

Users store encrypted API keys for:

| Type | Used by |
| --- | --- |
| `OPENAI` | OpenAI node |
| `ANTHROPIC` | Anthropic node |
| `GEMINI` | Gemini node |
| `RESEND` | Email node |
| `GOOGLE_SHEETS` | Google Sheets node |

Keys are encrypted at rest (AES via Cryptr) and decrypted only inside Inngest
executors at runtime. Creating and updating credentials requires a Pro
subscription.

See [Credentials](./features/credentials.md).

---

## Subscriptions

Polar.sh manages billing. Free users can view, open, and execute existing
workflows. **Pro** unlocks creating workflows, creating/updating credentials, and
AI workflow generation.

See [Subscriptions](./features/subscriptions.md).

---

## Admin panel

Users with the `ADMIN` role access `/admin` for:

- **User management** — list users, assign roles (`USER` / `ADMIN`).
- **Trigger kill switches** — enable or disable each `TriggerKind` globally
  (Manual, Google Form, Stripe, Schedule, Event Reminder).

See [Admin panel](./features/admin-panel.md).

---

## Functional requirements summary

| Area | Requirement |
| --- | --- |
| Auth | Email/password sign-up and sign-in via better-auth |
| Workflows | CRUD with visual editor; DAG validation on save and execute |
| Triggers | Five kinds; one trigger per workflow; global kill switches |
| Actions | Nine action node types including loop iteration |
| Templating | Handlebars in node text fields against shared execution context |
| Execution | Durable background runs via Inngest; realtime canvas status |
| Credentials | Encrypted per-user vault; selected in node dialogs |
| AI planner | Natural-language → validated plan → optional one-click workflow creation |
| Calendar | User-owned events drive Event Reminder triggers |
| Billing | Polar.sh Pro gate on workflow/credential creation and AI generation |
| Admin | Role-based access; per-trigger-type platform kill switches |

---

## Out of scope (current release)

- Multi-trigger workflows (exactly one trigger per workflow).
- Write operations on Google Sheets (read-only today).
- Native Gmail, Twilio, or other services without an HTTP Request workaround.
- Team / organization workspaces (single-user ownership model).
