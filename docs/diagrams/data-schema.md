# Data Schema Diagram

> For the complete, current database documentation, see **[../database.md](../database.md)** and **[er-diagram.md](./er-diagram.md)**.

The database schema is defined in `frontend/prisma/schema.prisma`. See those documents for the full field-level reference, constraints, indexes, and migration history.

## Quick Reference: Table Columns

```
user               (id, email*, name, emailVerified, image, role, banned, banReason, banExpires, createdAt, updatedAt)
session            (id, expiresAt, token*, createdAt, updatedAt, ipAddress, userAgent, impersonatedBy, userId→user)
account            (id, accountId, providerId, userId→user, accessToken, refreshToken, idToken, ..., password, createdAt, updatedAt)
verification       (id, identifier, value, expiresAt, createdAt, updatedAt)
credential         (id, name, value[encrypted], type, createdAt, updatedAt, userId→user)
workflow           (id, name, userId→user, createdAt, updatedAt)
node               (id, workflowId→workflow, name, type[NodeType], position[json], data[json], credentialId→credential, createdAt, updatedAt)
connection         (id, workflowId→workflow, fromNodeId→node, toNodeId→node, fromOutput, toInput, createdAt, updatedAt)
                   UNIQUE(fromNodeId, toNodeId, fromOutput, toInput)
execution          (id, workflowId→workflow, status[ExecutionStatus], error, errorStack, startedAt, completedAt, inngestEventId*, output[json])
workflow_execution_snapshot (workflowId→workflow PK, phase, nodeStatuses[json], updatedAt)
trigger_setting    (kind PK [TriggerKind], enabled, updatedAt)
```

`*` = UNIQUE constraint
