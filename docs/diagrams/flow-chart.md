# User Journey Flowchart

Main user journey through the FlowForge application.

```mermaid
flowchart TD
    Start([User visits app]) --> Auth{Authenticated?}

    Auth -->|No| Login[/login or /signup]
    Login -->|Credentials ok| Dashboard
    Auth -->|Yes| Dashboard

    Dashboard[/workflows - Workflow List] --> SubCheck{Active subscription?}

    SubCheck -->|No - Create Workflow| Upgrade[Show: Upgrade to Pro]
    Upgrade -->|Click Upgrade| PolarCheckout[Polar.sh checkout]
    PolarCheckout -->|Payment success| Dashboard

    SubCheck -->|Yes| CreateWF[Create Workflow]
    CreateWF --> Editor[Open /workflows/:id - Visual Editor]

    Editor --> AddNodes[Add + Configure Nodes]
    AddNodes --> ConnectNodes[Connect Nodes with Edges]
    ConnectNodes --> Save[Save Canvas]
    Save --> Execute{Has manual trigger?}

    Execute -->|Yes| RunBtn[Click Execute]
    Execute -->|No| ConfigureWebhook[Configure webhook trigger]
    ConfigureWebhook --> ExternalTrigger[External: Google Form / Stripe fires webhook]
    ExternalTrigger --> Running

    RunBtn --> Running[Workflow Running<br/>Live node status on canvas]
    Running --> Done{Execution result}
    Done -->|Success| Success[All nodes green ✓]
    Done -->|Failure| Failure[Failed node red ✗]

    Success --> History[View in /executions]
    Failure --> History

    History --> Debug[View output + error details]
```
