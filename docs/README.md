# FlowForge Documentation

FlowForge is a visual workflow automation platform. Users build pipelines of interconnected nodes on a drag-and-drop canvas, then trigger those pipelines manually or via external webhooks (Google Forms, Stripe). Each node performs a discrete task — calling an AI model, making an HTTP request, or posting to a messaging platform.

This index is the starting point for all engineering, product, and architecture knowledge.

---

## Navigation

### Architecture & Design
| Document | Description |
|---|---|
| [System Overview](./system-overview.md) | Product purpose, user journeys, high-level architecture |
| [System Design Document](./system-design.md) | End-to-end architecture, data flows, sequence diagrams, state management |
| [Tech Stack](./tech-stack.md) | Every technology used, why it was chosen, and how it is configured |

### Requirements
| Document | Description |
|---|---|
| [Product Requirements (PRD)](./prd.md) | Vision, user personas, functional requirements, user stories |
| [Technical Requirements (TRD)](./trd.md) | Infrastructure, database design, integrations, deployment, observability |

### Implementation Reference
| Document | Description |
|---|---|
| [Frontend Guide](./frontend.md) | Folder structure, routing, components, state, hooks, feature modules |
| [Backend Guide](./backend.md) | tRPC routers, procedures, business logic, execution engine, background jobs |
| [Database Guide](./database.md) | Schema, ERD, relationships, constraints, migration history |
| [API Reference](./api-reference.md) | Every tRPC procedure and REST endpoint with full schemas |

### Features
| Document | Description |
|---|---|
| [Workflow Editor](./features/workflow-editor.md) | Canvas editor, node types, save/load mechanics |
| [Workflow Execution](./features/workflow-execution.md) | Execution engine, topological sort, context propagation, realtime status |
| [Credentials](./features/credentials.md) | API key storage, encryption, assignment to nodes |
| [Triggers](./features/triggers.md) | Manual, Google Form, and Stripe trigger setup and enforcement |
| [Integrations](./features/integrations.md) | Per-node integration details: OpenAI, Anthropic, Gemini, Discord, Slack, HTTP |
| [Admin Panel](./features/admin-panel.md) | User management, role assignment, trigger kill-switches |
| [Subscriptions](./features/subscriptions.md) | Polar.sh billing, paywalled features, checkout flow |

### Infrastructure
| Document | Description |
|---|---|
| [Deployment & DevOps](./deployment.md) | Local setup, environment variables, Docker, production deployment |

### Diagrams
| Document | Description |
|---|---|
| [Entity-Relationship Diagram](./diagrams/er-diagram.md) | Database ERD |
| [Execution Sequence Diagram](./diagrams/sequence-diagram.md) | Workflow execution flow |
| [Architecture Diagram](./diagrams/architecture.md) | System component map |
| [Data Flow Diagram](./diagrams/data-flow.md) | How data moves through workflow execution |

---

## Quick-Start for New Engineers

1. Read [System Overview](./system-overview.md) to understand what the product does.
2. Read [Tech Stack](./tech-stack.md) to understand every tool in the project.
3. Follow [Deployment & DevOps](./deployment.md) to run the app locally.
4. Read [Workflow Execution](./features/workflow-execution.md) — it is the core domain logic.
5. Use [API Reference](./api-reference.md) and [Database Guide](./database.md) when working on data flows.
