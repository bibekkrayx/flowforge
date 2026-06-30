# Workflow Editor

## Overview

The workflow editor is a visual, node-based canvas that lets users compose automation pipelines by placing nodes, connecting them with edges, and configuring each node's settings. It is built on React Flow (`@xyflow/react`).

**Route**: `/workflows/[workflowId]`  
**Key file**: `features/editor/components/editor.tsx`

---

## User Flow

```
1. User opens workflow from list (navigates to /workflows/[workflowId])
2. Editor loads workflow data via tRPC (useSuspenseWorkflow)
3. Canvas renders existing nodes and edges
4. User modifies the canvas (add nodes, drag, connect, configure)
5. User clicks "Save" → trpc.workflows.update fires
6. User clicks "Execute" (if manual trigger exists) → trpc.workflows.execute fires
```

---

## Architecture

### Canvas Component (`features/editor/components/editor.tsx`)

The `Editor` component:
- Fetches the workflow from `trpc.workflows.getOne.useSuspenseQuery({ id: workflowId })`.
- Holds local `useState` for `nodes[]` and `edges[]` (initialized from server data).
- Mounts `WorkflowExecutionProvider` to pass `syncNodeStatus` and `resetAllNodeStatuses` callbacks to child components.
- Renders `WorkflowExecutionSubscriber` (invisible component that subscribes to realtime updates).
- Renders `<ReactFlow>` with:
  - `nodeTypes={nodeComponents}` — maps node type strings to React components.
  - Event handlers: `onNodesChange`, `onEdgesChange`, `onConnect`.
  - `snapToGrid={true}`, `snapGrid={[10, 10]}`.
  - `panOnScroll={true}`, `panOnDrag={false}`, `selectionOnDrag={true}`.
  - Background, Controls, MiniMap panels.
  - `AddNodeButton` (top-right panel).
  - `ExecuteWorkflowButton` (bottom-center panel, only if manual trigger exists).

### State Flow

```
Server (tRPC) → React state (nodes, edges)
                     │
           React Flow event handlers
           (onNodesChange, onEdgesChange, onConnect)
                     │
           Local state updated
                     │
           User clicks Save
                     │
           trpc.workflows.update.mutate({ id, nodes, edges })
                     │
           Database (transaction: delete + recreate)
```

### Editor Atom (`features/editor/store/atoms.ts`)

```ts
export const editorAtom = atom<ReactFlowInstance | null>(null);
```

The React Flow instance is stored in a Jotai atom via the `onInit` prop on `<ReactFlow>`. This allows other components to call methods like `fitView()` programmatically.

---

## Adding Nodes

### AddNodeButton (`features/editor/components/add-node-button.tsx`)
- Renders a "+" button in the top-right panel of the canvas.
- Opens a `NodeSelector` dialog listing all available node types.
- On selection, creates a new React Flow node with a CUID2 ID, places it at a default position, and adds it to local state.

### Node Types Available in Selector
Nodes are shown from the `nodeComponents` registry (`config/node-components.ts`). The full list:
- INITIAL (hidden — auto-created, not manually addable)
- MANUAL_TRIGGER
- HTTP_REQUEST
- GOOGLE_FORM_TRIGGER
- STRIPE_TRIGGER
- OPENAI
- ANTHROPIC
- GEMINI
- DISCORD
- SLACK

---

## Node Configuration

Each node renders its own settings dialog. The dialog is opened by clicking a configure button on the node card.

### Node Data (`node.data` field)
Node configuration is stored in the `data` JSON field on the `Node` model. This is the same object passed as React Flow node `data`. Each executor reads from `node.data` at execution time.

### Configuration Dialogs
Located at `features/execution/components/[node-type]/dialog.tsx` and `features/triggers/components/[node-type]/dialog.tsx`.

Each dialog uses `react-hook-form` + Zod for validation. On submit, the form data is merged into the node's `data` field in local state. Changes are only persisted when the user saves the canvas.

---

## Saving the Canvas

**Button**: "Save" button in `EditorHeader`  
**Procedure**: `trpc.workflows.update.mutate({ id, nodes, edges })`

What is saved:
- Node positions (`{ x, y }`)
- Node configuration data (`node.data`)
- Node IDs and types
- Edge connections (source, target, handles)

**Transaction behavior**: The save operation deletes all existing nodes and connections for the workflow and recreates them. This means node IDs from the client must be stable (they are — React Flow nodes use CUID2 IDs assigned at creation).

---

## Executing a Workflow

**Button**: Only shown if the workflow contains a `MANUAL_TRIGGER` or `INITIAL` node.  
**Component**: `features/editor/components/execute-workflow-button.tsx`  
**Procedure**: `trpc.workflows.execute.mutate({ id: workflowId })`

On click:
1. tRPC mutation fires `sendWorkflowExecution` via the Inngest event.
2. `WorkflowExecutionSubscriber` begins receiving realtime status events.
3. Node cards update their `data.executionStatus` to show loading/success/error.

---

## Real-time Node Status Updates

During execution, node status is displayed on the canvas:
- **Loading** (spinner): node is currently being executed.
- **Success** (green check): node completed successfully.
- **Error** (red X): node failed.

### Status Update Path

```
Inngest executor
    → publishNodeStatus("loading"/"success"/"error")
    → WorkflowExecutionSnapshot (DB) + Inngest Realtime publish

Browser
    → WorkflowExecutionSubscriber:
        Path 1: useRealtime() WebSocket → applyEvent() → syncNodeStatus()
        Path 2: Polling fallback (1s) → GET /api/workflows/[id]/execution-status → syncNodeStatus()

syncNodeStatus(nodeId, status, nodeType)
    → setNodes() update: node.data.executionStatus = status
    → NodeStatusIndicator re-renders with new status
```

### `resolveNodeIdForStatus` Logic
Some nodes have a legacy INITIAL node that needs to display status from the MANUAL_TRIGGER node. `resolveNodeIdForStatus` maps the execution node ID to the canvas node ID, handling this edge case.

---

## Node Component Structure

Each node type has:
- **`node.tsx`**: React Flow node component rendered on the canvas. Extends `BaseNode` or `BaseExecutionNode`. Shows node icon, name, handles (input/output), and `NodeStatusIndicator`.
- **`dialog.tsx`**: Configuration form shown in a sheet/dialog.
- **`executor.ts`**: Server-side function that runs the node during Inngest execution.
- **`actions.ts`**: tRPC mutations called from the dialog (e.g., saving trigger settings).

---

## Canvas Configuration Details

| Option | Value | Effect |
|---|---|---|
| `colorMode` | `"dark"` | Dark canvas background |
| `snapToGrid` | `true`, `[10, 10]` | Nodes snap to 10px grid |
| `panOnScroll` | `true` | Scroll to pan |
| `panOnDrag` | `false` | Click-drag does not pan |
| `selectionOnDrag` | `true` | Click-drag creates a selection box |
| `defaultEdgeOptions.style` | `stroke: var(--color-primary)` | Primary color edges |
| `proOptions.hideAttribution` | `true` | Hides React Flow attribution badge |

---

## Edge Cases

- **Workflow with no trigger**: The Execute button is hidden. Users must add a MANUAL_TRIGGER or INITIAL node.
- **Duplicate edges**: The `workflows.update` procedure deduplicates edges by `(source, target, sourceHandle, targetHandle)` key before saving.
- **Cyclic workflows**: The topological sort in `inngest/utils.ts` throws an error if a cycle is detected. Execution will fail with a clear error message.
- **Node with no credential**: If an AI node is executed without a credential assigned, it throws `NonRetriableError` immediately.
