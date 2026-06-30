import type { CredentialType, NodeType } from "@/generated/prisma/enums";

export type { CredentialType, NodeType };

/**
 * Whether a node starts a workflow (trigger) or runs as part of it (action).
 */
export type NodeKind = "trigger" | "action";

/**
 * A serializable description of a single supported node type, derived from the
 * existing node registry and display metadata. Consumed by the AI planner so it
 * can reason about the app's real capabilities without hallucinating node types.
 */
export type NodeCapability = {
  type: NodeType;
  label: string;
  description: string;
  kind: NodeKind;
  /** Credential the user must connect for this node, if any. */
  credentialType?: CredentialType;
  /** Human-readable, non-credential config fields the user must fill. */
  requiredConfig: string[];
};

/**
 * A serializable snapshot of everything the planner needs to know about the
 * app's capabilities. Safe to embed in a prompt.
 */
export type CapabilitySnapshot = {
  nodes: NodeCapability[];
  triggers: NodeCapability[];
  actions: NodeCapability[];
  credentialTypes: CredentialType[];
  connectionRules: string[];
};

export type {
  EditOperation,
  Graph,
  GraphEdge,
  GraphNode,
} from "@/features/ai-workflow/edit/edit-operations";

export {
  addNode,
  applyEditOperation,
  insertNodeBetween,
  removeNode,
  replaceNode,
} from "@/features/ai-workflow/edit/edit-operations";
