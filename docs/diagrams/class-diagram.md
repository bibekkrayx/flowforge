# Module Dependency Diagram

> For full implementation details, see **[../backend.md](../backend.md)** and **[../frontend.md](../frontend.md)**.

## Core Module Dependencies

```mermaid
classDiagram
    class InngestFunction {
        +execute-workflow()
        +onFailure()
    }

    class ExecutorRegistry {
        +executorRegistry: Record~NodeType,NodeExecutor~
        +getExecutor(type): NodeExecutor
    }

    class NodeExecutor {
        <<interface>>
        +execute(params: NodeExecutorParams): Promise~WorkflowContext~
    }

    class TopologicalSort {
        +topologicalSort(nodes, connections): Node[]
    }

    class TriggerEnforcement {
        +assertTriggerEnabled(kind): void
        +assertWorkflowTriggersEnabled(nodeTypes): void
        +TriggerDisabledError
    }

    class ExecutionStatusStore {
        +resetCachedExecution(workflowId): void
        +setCachedNodeStatus(workflowId, nodeId, status): void
        +setCachedExecutionPhase(workflowId, phase): void
        +getCachedExecution(workflowId): CachedExecution
    }

    class PublishExecutionEvent {
        +publishExecutionStarted(publish, workflowId): void
        +publishExecutionCompleted(publish, workflowId, success): void
        +publishNodeStatus(publish, workflowId, nodeId, nodeType, status): void
    }

    class Encryption {
        +encrypt(text): string
        +decrypt(text): string
    }

    class Auth {
        +betterAuth instance
        +emailAndPassword
        +admin plugin
        +polar plugin
    }

    class AppRouter {
        +workflowsRouter
        +credentialsRouter
        +executionsRouter
        +adminRouter
    }

    class tRPCInit {
        +baseProcedure
        +protectedProcedure
        +premiumProcedure
        +adminProcedure
    }

    InngestFunction --> ExecutorRegistry : uses
    InngestFunction --> TopologicalSort : uses
    InngestFunction --> TriggerEnforcement : uses
    InngestFunction --> PublishExecutionEvent : uses
    ExecutorRegistry --> NodeExecutor : contains
    PublishExecutionEvent --> ExecutionStatusStore : uses
    AppRouter --> tRPCInit : extends procedures
    AppRouter ..> Auth : session check
    AppRouter ..> Encryption : credentials
```

## Node Type Relationships

```mermaid
classDiagram
    class NodeType {
        <<enum>>
        INITIAL
        MANUAL_TRIGGER
        HTTP_REQUEST
        GOOGLE_FORM_TRIGGER
        STRIPE_TRIGGER
        ANTHROPIC
        GEMINI
        OPENAI
        DISCORD
        SLACK
    }

    class nodeComponents {
        <<config>>
        Maps NodeType → React Component
    }

    class executorRegistry {
        <<config>>
        Maps NodeType → NodeExecutor function
    }

    NodeType --> nodeComponents : rendered by
    NodeType --> executorRegistry : executed by
```
