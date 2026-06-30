# Entity-Relationship Diagram

Database schema for FlowForge derived from `frontend/prisma/schema.prisma`.

```mermaid
erDiagram
    User {
        String id PK
        String email UK
        String name
        Boolean emailVerified
        String image
        UserRole role
        Boolean banned
        String banReason
        DateTime banExpires
        DateTime createdAt
        DateTime updatedAt
    }

    Session {
        String id PK
        DateTime expiresAt
        String token UK
        DateTime createdAt
        DateTime updatedAt
        String ipAddress
        String userAgent
        String impersonatedBy
        String userId FK
    }

    Account {
        String id PK
        String accountId
        String providerId
        String userId FK
        String accessToken
        String refreshToken
        String idToken
        DateTime accessTokenExpiresAt
        DateTime refreshTokenExpiresAt
        String scope
        String password
        DateTime createdAt
        DateTime updatedAt
    }

    Verification {
        String id PK
        String identifier
        String value
        DateTime expiresAt
        DateTime createdAt
        DateTime updatedAt
    }

    Credential {
        String id PK
        String name
        String value
        CredentialType type
        DateTime createdAt
        DateTime updatedAt
        String userId FK
    }

    Workflow {
        String id PK
        String name
        String userId FK
        DateTime createdAt
        DateTime updatedAt
    }

    Node {
        String id PK
        String workflowId FK
        String name
        NodeType type
        Json position
        Json data
        String credentialId FK
        DateTime createdAt
        DateTime updatedAt
    }

    Connection {
        String id PK
        String workflowId FK
        String fromNodeId FK
        String toNodeId FK
        String fromOutput
        String toInput
        DateTime createdAt
        DateTime updatedAt
    }

    Execution {
        String id PK
        String workflowId FK
        ExecutionStatus status
        String error
        String errorStack
        DateTime startedAt
        DateTime completedAt
        String inngestEventId UK
        Json output
    }

    WorkflowExecutionSnapshot {
        String workflowId PK_FK
        String phase
        Json nodeStatuses
        DateTime updatedAt
    }

    TriggerSetting {
        TriggerKind kind PK
        Boolean enabled
        DateTime updatedAt
    }

    User ||--o{ Session : "has"
    User ||--o{ Account : "has"
    User ||--o{ Workflow : "owns"
    User ||--o{ Credential : "owns"

    Workflow ||--o{ Node : "contains"
    Workflow ||--o{ Connection : "has"
    Workflow ||--o{ Execution : "records"
    Workflow ||--o| WorkflowExecutionSnapshot : "snapshot"

    Node }o--o| Credential : "uses"
    Node ||--o{ Connection : "source (FromNode)"
    Node ||--o{ Connection : "target (ToNode)"
```

## Key Constraints

| Table | Constraint | Columns |
|---|---|---|
| `user` | UNIQUE | `email` |
| `session` | UNIQUE | `token` |
| `session` | INDEX | `userId` |
| `account` | INDEX | `userId` |
| `verification` | INDEX | `identifier` |
| `connection` | UNIQUE | `(fromNodeId, toNodeId, fromOutput, toInput)` |
| `execution` | UNIQUE | `inngestEventId` |
| `trigger_setting` | PRIMARY KEY | `kind` |
| `workflow_execution_snapshot` | PRIMARY KEY + FK | `workflowId` |

## Cascade Delete Rules

| Parent deleted | Cascades to |
|---|---|
| User | Sessions, Accounts, Workflows, Credentials |
| Workflow | Nodes, Connections, Executions, WorkflowExecutionSnapshot |
| Node (from/to) | Connections referencing that node |
