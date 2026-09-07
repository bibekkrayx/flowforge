# Application Flow Diagram

> For comprehensive flow details, see:
> - **[../system-design.md](../system-design.md)** — data flows and request lifecycles
> - **[data-flow.md](./data-flow.md)** — detailed execution context and status flows
> - **[sequence-diagram.md](./sequence-diagram.md)** — step-by-step sequence diagrams

## Execution Flow (Summary)

```mermaid
flowchart LR
    subgraph Triggers
        Manual[Manual click<br/>tRPC workflows.execute]
        GoogleForm[Google Form submission<br/>POST /api/webhooks/google-form]
        Stripe[Stripe event<br/>POST /api/webhooks/stripe]
    end

    subgraph Enforcement
        TriggerCheck[assertTriggerEnabled<br/>TriggerSetting DB check]
    end

    subgraph Execution
        Inngest[Inngest Cloud<br/>execute-workflow function]
        TopoSort[Topological Sort<br/>of nodes]
        NodeLoop[Execute each node<br/>in order]
    end

    subgraph Output
        DB[(Execution record)]
        Canvas[Live canvas status<br/>via Realtime + polling]
    end

    Manual --> TriggerCheck
    GoogleForm --> TriggerCheck
    Stripe --> TriggerCheck

    TriggerCheck -->|enabled| Inngest
    TriggerCheck -->|disabled| Blocked[403 / FORBIDDEN]

    Inngest --> TopoSort
    TopoSort --> NodeLoop
    NodeLoop --> DB
    NodeLoop --> Canvas
```

## Subscription Gate Flow

```mermaid
flowchart LR
    User -->|workflows.create<br/>credentials.create| premiumProcedure
    premiumProcedure -->|polarClient.getStateExternal| Polar[Polar.sh]
    Polar -->|activeSubscriptions = []| FORBIDDEN[FORBIDDEN error]
    Polar -->|activeSubscriptions has items| Proceed[Execute procedure]
```
