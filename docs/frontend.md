# Frontend Documentation

## 1. Folder Structure

```
frontend/
├── app/                      Next.js App Router (pages + API)
│   ├── layout.tsx            Root layout with global providers
│   ├── globals.css           Global styles and Tailwind tokens
│   ├── (auth)/               Auth route group (no sidebar)
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/          Dashboard route group (with sidebar)
│   │   ├── layout.tsx        AppSidebar + SidebarProvider
│   │   ├── (editor)/         Editor sub-group (full-screen canvas)
│   │   │   └── workflows/[workflowId]/page.tsx
│   │   └── (rest)/           Standard dashboard pages
│   │       ├── workflows/
│   │       ├── credentials/
│   │       ├── executions/
│   │       └── subscriptions/
│   ├── admin/                Admin portal (separate auth context)
│   │   ├── login/page.tsx
│   │   ├── page.tsx
│   │   └── (protected)/
│   │       ├── layout.tsx    Admin auth guard
│   │       ├── users/page.tsx
│   │       └── triggers/page.tsx
│   └── api/                  Next.js Route Handlers
│       ├── auth/[...all]/    better-auth
│       ├── inngest/          Inngest function handler
│       ├── trpc/[trpc]/      tRPC handler
│       ├── webhooks/         External webhooks
│       └── workflows/[id]/execution-status/
├── components/               Shared UI components
│   ├── ui/                   shadcn/ui primitives
│   ├── react-flow/           Canvas-specific base components
│   ├── app-sidebar.tsx
│   ├── workflow-node.tsx
│   ├── base-execution-node.tsx
│   ├── initial-node.tsx
│   ├── node-selector.tsx
│   └── upgrade-model.tsx
├── config/
│   ├── constants.ts          Pagination defaults
│   └── node-components.ts    NodeType → React component map
├── features/                 Domain modules (see Feature Modules section)
├── hooks/                    Shared custom React hooks
├── inngest/                  Inngest client, events, functions, channels
├── lib/                      Pure utility libraries
├── prisma/                   Schema + migrations
├── generated/prisma/         Prisma-generated types
├── public/logos/             Integration SVG logos
├── trpc/                     tRPC setup (init, router, client, server)
└── scripts/                  One-off scripts (bootstrap-admin)
```

---

## 2. Routing Architecture

### Route Groups
Next.js App Router route groups (`(groupName)`) are used to share layouts without affecting the URL:

| Group | Layout | Content |
|---|---|---|
| `(auth)` | None (bare) | Login and signup pages |
| `(dashboard)` | AppSidebar + SidebarProvider | All authenticated user pages |
| `(dashboard)/(editor)` | None (inherits dashboard) | Full-screen workflow canvas |
| `(dashboard)/(rest)` | None (inherits dashboard) | Padded content pages |
| `admin/(protected)` | Admin auth guard | Admin panel pages |

### Key Routes

| URL | Page | Auth Required |
|---|---|---|
| `/login` | Login form | No |
| `/signup` | Signup form | No |
| `/workflows` | Workflow list | Session |
| `/workflows/[workflowId]` | Visual editor | Session |
| `/credentials` | Credential list | Session |
| `/credentials/new` | New credential form | Session + Pro |
| `/credentials/[id]` | Edit credential | Session + Pro |
| `/executions` | Execution history | Session |
| `/executions/[executionId]` | Execution detail | Session |
| `/subscriptions` | Subscription info | Session |
| `/admin` | Admin root | Admin |
| `/admin/login` | Admin login | No |
| `/admin/users` | User management | Admin |
| `/admin/triggers` | Trigger settings | Admin |

---

## 3. Component Architecture

### Layer 1: shadcn/ui Primitives (`components/ui/`)
Self-contained accessible UI primitives copied from shadcn/ui. These are the foundation:
- Layout: `Sidebar`, `Card`, `Separator`, `Resizable`, `ScrollArea`
- Form: `Input`, `Button`, `Select`, `Checkbox`, `Form`, `Label`, `Field`
- Overlay: `Dialog`, `Drawer`, `Sheet`, `Popover`, `Tooltip`, `Alert`
- Data: `Table`, `Badge`, `Skeleton`, `Spinner`, `Progress`
- Navigation: `Breadcrumb`, `Tabs`

### Layer 2: React Flow Primitives (`components/react-flow/`)
Canvas-specific base components:
- `BaseNode` — Shared node card shell (border, header, handles)
- `BaseHandle` — Styled React Flow Handle
- `NodeStatusIndicator` — Loading/success/error badge shown on nodes during execution
- `PlaceholderNode` — Empty drop target node

### Layer 3: App-Level Shared Components (`components/`)
- `AppSidebar` — Navigation sidebar with route links, upgrade button, billing portal, sign out
- `WorkflowNode` — Generic workflow node wrapper
- `BaseExecutionNode` — Node base with execution status support
- `InitialNode` — The INITIAL placeholder node rendered at workflow creation
- `NodeSelector` — Modal for selecting a node type to add to the canvas
- `UpgradeModal` — Subscription upgrade prompt dialog

### Layer 4: Feature Components (`features/*/components/`)
Domain-specific components owned by each feature module (see Feature Modules below).

---

## 4. Feature Modules

Each feature under `features/` owns its full slice:

```
features/[feature]/
├── components/      UI components
├── hooks/           React Query + custom hooks
├── server/
│   ├── routers.ts   tRPC router procedures
│   ├── prefetch.ts  RSC-side tRPC prefetch helpers
│   └── params-loader.ts  Route param loading for RSC
├── params.ts        nuqs parameter definitions
└── types/           Feature-specific types
```

### `features/auth`
- Components: `LoginForm`, `SignupForm`, `SignoutButton`
- No tRPC router (auth handled by better-auth REST endpoints)

### `features/workflows`
- Components: `Workflows` (list view)
- Hooks: `useWorkflows`, `useSuspenseWorkflow`, `useWorkflowParams`
- Router: `workflowsRouter` — CRUD + execute + Google Form trigger update

### `features/editor`
- Components: `Editor`, `EditorHeader`, `AddNodeButton`, `CustomNode`, `ExecuteWorkflowButton`
- State: `editorAtom` (Jotai) — React Flow instance ref
- No tRPC router; uses `workflowsRouter.update` and `workflowsRouter.execute`

### `features/execution`
- Components: Per-integration node UIs + dialogs (`openai/`, `anthropic/`, `gemini/`, `discord/`, `slack/`, `http-request/`)
- Also: `WorkflowExecutionSubscriber`, `Execution`, `Executions`
- Hooks: `useExecutions`, `useExecutionsParams`, `useDialogFormReset`
- Context: `WorkflowExecutionProvider` + `useWorkflowExecutionContext` — passes `syncNodeStatus` callback to editor
- Actions: `fetchWorkflowExecutionToken` (Server Action for Inngest Realtime token)
- Executor registry: `libs/executor-registry.tsx` — maps `NodeType` → executor function
- Router: `executionsRouter` — getOne, getMany

### `features/triggers`
- Components: Per-trigger node UIs + dialogs (`google-form-trigger/`, `manual-trigger/`, `stripe-trigger/`)
- Each trigger has: `node.tsx`, `dialog.tsx`, `executor.ts`, `actions.ts`

### `features/credentials`
- Components: `Credential`, `Credentials`
- Hooks: `useCredentials`, `useCredentialsParams`
- Router: `credentialsRouter` — full CRUD + getByType

### `features/subscriptions`
- Components: `SubscriptionsView`
- Hooks: `useSubscription`, `useHasActiveSubscription`

### `features/admin`
- Components: User list, trigger settings UI (within `app/admin/`)
- Services: `adminUserService`, `triggerSettingsService`
- Repositories: `adminUserRepository`, `triggerSettingsRepository`
- Router: `adminRouter` — user management + trigger settings

---

## 5. State Management

### Server State (TanStack Query + tRPC)
All data fetched from the server flows through tRPC procedures and is cached by TanStack Query:
- `trpc.workflows.getMany.useQuery(...)` — paginated workflow list
- `trpc.workflows.getOne.useSuspenseQuery(...)` — single workflow (suspense-enabled for editor)
- `trpc.credentials.getMany.useQuery(...)` — credential list
- `trpc.executions.getMany.useQuery(...)` — execution history
- Mutations automatically invalidate relevant query caches on success.

### Client State (Jotai atoms)
| Atom | File | Purpose |
|---|---|---|
| `editorAtom` | `features/editor/store/atoms.ts` | Stores the React Flow instance (for programmatic viewport control) |
| `upgradeModalAtom` | `hooks/use-upgrade-modal.tsx` | Controls upgrade dialog visibility |

### URL State (nuqs)
Used for stateful pagination and search that survives navigation:
- `page`, `pageSize`, `search` in workflow, credential, and execution list pages.
- Defined in `features/[feature]/params.ts`.

### Canvas State (React `useState`)
The editor's `nodes` and `edges` arrays are local React state:
- Initialized from `trpc.workflows.getOne` data.
- Updated via React Flow's `applyNodeChanges` / `applyEdgeChanges` / `addEdge` helpers.
- Persisted by calling `trpc.workflows.update.mutate(...)` with the current nodes+edges snapshot.

### Realtime Execution State
During execution, node statuses are updated via:
1. Inngest Realtime WebSocket: `WorkflowExecutionSubscriber` calls `syncNodeStatus()` from context.
2. Polling fallback: 1-second interval fetch to `/api/workflows/[id]/execution-status`.

`syncNodeStatus()` and `resetAllNodeStatuses()` are defined in `Editor` and passed down through `WorkflowExecutionProvider`.

---

## 6. Hooks

### Shared Hooks (`hooks/`)

| Hook | File | Purpose |
|---|---|---|
| `useAppOrigin` | `hooks/use-app-origin.ts` | Returns window.location.origin (client-safe) |
| `useEntitySearch` | `hooks/use-entity-search.tsx` | Debounced search input state |
| `useMobile` | `hooks/use-mobile.ts` | Responsive mobile breakpoint detection |
| `useUpgradeModal` | `hooks/use-upgrade-modal.tsx` | Controls upgrade modal (Jotai atom) |

### Feature Hooks
- `useHasActiveSubscription` — Queries Polar customer state for subscription check
- `useWorkflows`, `useSuspenseWorkflow` — Typed wrappers over tRPC workflow queries
- `useWorkflowParams` — nuqs-based URL params for workflows list
- `useCredentials` — tRPC credential list query
- `useCredentialsParams` — nuqs-based URL params for credentials list
- `useExecutions` — tRPC execution list query
- `useExecutionsParams` — nuqs URL params for executions list
- `useDialogFormReset` — Resets a react-hook-form on dialog close

---

## 7. API Integration Patterns

### tRPC Client Call Pattern
```tsx
// Query (client component)
const { data, isLoading } = trpc.workflows.getMany.useQuery({ page: 1, pageSize: 5 });

// Mutation with cache invalidation
const utils = trpc.useUtils();
const { mutate } = trpc.workflows.create.useMutation({
  onSuccess: () => utils.workflows.getMany.invalidate(),
});
```

### Server-side Prefetch (RSC)
```tsx
// In a server component or page
import { prefetchWorkflows } from "@/features/workflows/server/prefetch";
await prefetchWorkflows(trpcServer, { page: 1, pageSize: 5 });
```

### Server Action Pattern (for Inngest token)
```tsx
// fetchWorkflowExecutionToken is a "use server" function
const token = await fetchWorkflowExecutionToken(workflowId);
```

---

## 8. UI Patterns

### Loading and Error States
- Suspense boundaries wrap data-dependent components; `EditorLoading` / `EditorError` are exported for the editor.
- `react-error-boundary` catches errors in the editor and shows a fallback.
- `Skeleton` components shown during data loading.
- `Empty` component shown for empty list states.

### Forms
- All forms use `react-hook-form` + Zod schema validation via `@hookform/resolvers/zod`.
- `Form`, `Field`, `Input`, `Select`, `Button` from `components/ui/`.
- Error messages rendered inline beneath each field via `FormMessage`.

### Notifications
- `sonner` toast library via `Toaster` in root layout.
- Used for success/error feedback on mutations.

### Upgrade Gate
When a free user attempts a Pro-gated action:
1. The mutation returns a tRPC FORBIDDEN error.
2. The UI catches the error and opens the upgrade modal or redirects to the checkout.

---

## 9. Design System

### Theming
- Tailwind CSS 4 with CSS variable tokens in `app/globals.css`.
- Dark mode only (HTML root has `className="dark"`).
- Primary color: used for workflow node borders, edge colors, and primary buttons.

### Typography
- Body text: Roboto Slab (`--font-roboto-slab`)
- Code/headings: JetBrains Mono (`--font-jetbrains-heading`)

### Integration Logos
SVG logos for each integration stored in `public/logos/`:
- `anthropic.svg`, `discord.svg`, `gemini.svg`, `google.svg`, `googleform.svg`, `openai.svg`, `slack.svg`, `stripe.svg`, `logo.png`

---

## 10. Node Component Registration

Node types are registered in two places:

### Canvas Rendering (`config/node-components.ts`)
Maps `NodeType` enum → React component rendered on the canvas:
```ts
export const nodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.HTTP_REQUEST]: HttpRequestNode,
  [NodeType.MANUAL_TRIGGER]: ManualTriggerNode,
  // ...
} satisfies NodeTypes
```
Passed to `<ReactFlow nodeTypes={nodeComponents} />`.

### Execution (`features/execution/libs/executor-registry.tsx`)
Maps `NodeType` enum → executor function called at runtime:
```ts
export const executorRegistry: Record<NodeType, NodeExecutor> = {
  [NodeType.INITIAL]: manualTriggerExecutor,
  [NodeType.HTTP_REQUEST]: httpRequestExecutor,
  // ...
}
```
Used by `getExecutor(nodeType)` inside the Inngest function.

To add a new node type, you must update **both** registries plus the Prisma `NodeType` enum and a new migration.
