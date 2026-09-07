import { NodeType } from "@/generated/prisma/enums";
import {
  getNodeCapability,
  SUPPORTED_NODE_TYPES,
} from "@/features/ai-workflow/capabilities/node-catalog";

/** A node in a generated workflow graph (validation-relevant fields only). */
export type GraphNode = {
  id: string;
  type: NodeType | string;
  data?: Record<string, unknown>;
};

/** A directed edge between two nodes, referenced by node id. */
export type GraphEdge = {
  source: string;
  target: string;
};

/** Outcome of validating a graph. `ok` is true only when there are no errors. */
export type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Trigger node types, used as a fallback when the node catalog has no entry for
 * a given type (e.g. the catalog is unavailable or out of date).
 */
const FALLBACK_TRIGGER_TYPES: ReadonlySet<string> = new Set([
  NodeType.MANUAL_TRIGGER,
  NodeType.GOOGLE_FORM_TRIGGER,
  NodeType.STRIPE_TRIGGER,
  NodeType.SCHEDULE_TRIGGER,
  NodeType.EVENT_TRIGGER,
]);

/** Set of supported node types for O(1) membership checks. */
const SUPPORTED_TYPES: ReadonlySet<string> = new Set(SUPPORTED_NODE_TYPES);

/**
 * True when a node acts as the workflow entry point — either a trigger node or
 * the internal INITIAL placeholder. Prefers the catalog's classification and
 * falls back to a static trigger-type set when the catalog has no entry.
 */
function isTriggerOrEntry(type: NodeType | string): boolean {
  if (type === NodeType.INITIAL) {
    return true;
  }
  const capability = getNodeCapability(type as NodeType);
  if (capability) {
    return capability.kind === "trigger";
  }
  return FALLBACK_TRIGGER_TYPES.has(type);
}

/**
 * Validate a generated workflow graph before it is persisted.
 *
 * Pure: performs no IO. Returns a list of human-readable errors and warnings.
 * `ok` is true only when there are no errors.
 */
export function validateGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Unsupported node types -------------------------------------------------
  for (const node of nodes) {
    const isEntryPlaceholder = node.type === NodeType.INITIAL;
    if (!isEntryPlaceholder && !SUPPORTED_TYPES.has(node.type)) {
      errors.push(
        `Node "${node.id}" has unsupported type "${node.type}"`,
      );
    }
  }

  // --- Trigger / entry node count --------------------------------------------
  const triggerNodes = nodes.filter((node) => isTriggerOrEntry(node.type));
  if (triggerNodes.length === 0) {
    errors.push("Workflow has no trigger");
  } else if (triggerNodes.length > 1) {
    const ids = triggerNodes.map((node) => `"${node.id}"`).join(", ");
    errors.push(
      `Workflow has more than one trigger (${triggerNodes.length}): ${ids}`,
    );
  }

  // --- Duplicate variable names ----------------------------------------------
  const seenVariableNames = new Set<string>();
  const reportedDuplicates = new Set<string>();
  for (const node of nodes) {
    const variableName = node.data?.variableName;
    if (typeof variableName !== "string" || variableName.length === 0) {
      continue;
    }
    if (seenVariableNames.has(variableName)) {
      if (!reportedDuplicates.has(variableName)) {
        errors.push(`Duplicate variable name "${variableName}"`);
        reportedDuplicates.add(variableName);
      }
    } else {
      seenVariableNames.add(variableName);
    }
  }

  // --- Node order: trigger must have no incoming edge -------------------------
  const incomingCount = new Map<string, number>();
  for (const node of nodes) {
    incomingCount.set(node.id, 0);
  }
  for (const edge of edges) {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
  }
  for (const trigger of triggerNodes) {
    if ((incomingCount.get(trigger.id) ?? 0) > 0) {
      errors.push(`Trigger "${trigger.id}" must not have an incoming edge`);
    }
  }

  // --- Reachability: every non-trigger node must reach back to a trigger ------
  // Only meaningful with more than one node and at least one trigger.
  if (nodes.length > 1 && triggerNodes.length > 0) {
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of edges) {
      adjacency.get(edge.source)?.push(edge.target);
    }

    const reachable = new Set<string>();
    const queue: string[] = triggerNodes.map((node) => node.id);
    for (const id of queue) {
      reachable.add(id);
    }
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const next of adjacency.get(current) ?? []) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }

    for (const node of nodes) {
      if (isTriggerOrEntry(node.type)) {
        continue;
      }
      if (!reachable.has(node.id)) {
        errors.push(
          `Node "${node.id}" is not reachable from a trigger (orphaned or appears before a trigger)`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
