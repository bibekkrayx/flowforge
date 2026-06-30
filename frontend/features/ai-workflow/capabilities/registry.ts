import { CredentialType } from "@/generated/prisma/enums";
import { NODE_CATALOG } from "@/features/ai-workflow/capabilities/node-catalog";
import type { CapabilitySnapshot } from "@/features/ai-workflow/types";

/**
 * Short, prompt-friendly statements describing how nodes connect into a runnable
 * workflow. Kept terse so they can be embedded directly in the planner prompt.
 */
const CONNECTION_RULES: readonly string[] = [
  "A workflow starts with exactly one trigger node.",
  "Action nodes run after the trigger in sequence, each connected to the previous node.",
  "Every action node has a variableName; its output is referenced by later nodes via that variableName.",
  "A node may only reference outputs from nodes that run before it.",
  "Only the node types listed in this catalog may be used — never invent node types.",
];

/**
 * Build a serializable capability snapshot for the AI planner from the catalog.
 * Triggers and actions are partitioned, and all credential types the app
 * supports are listed so the planner can reason about required connections.
 */
export function buildCapabilities(): CapabilitySnapshot {
  const nodes = [...NODE_CATALOG];

  return {
    nodes,
    triggers: nodes.filter((node) => node.kind === "trigger"),
    actions: nodes.filter((node) => node.kind === "action"),
    credentialTypes: Object.values(CredentialType),
    connectionRules: [...CONNECTION_RULES],
  };
}
