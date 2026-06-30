import { createId } from "@paralleldrive/cuid2";
import type { NodeType } from "@/generated/prisma/enums";
import type { WorkflowPlan } from "@/features/ai-workflow/schemas/plan";
import { defaultDataForNode } from "@/features/ai-workflow/generation/default-config";
import { layoutVertical } from "@/features/ai-workflow/generation/layout";

export type GraphNode = {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type PlanToGraphOptions = {
  /**
   * Injectable id generator so tests can assert a deterministic structure.
   * Defaults to CUID2 `createId`.
   */
  idFactory?: () => string;
};

/**
 * Convert an AI `WorkflowPlan` into React Flow nodes/edges in the exact shape
 * the `workflows.update` save API accepts.
 *
 * Each step becomes a node whose `data` is derived from `defaultDataForNode`,
 * passing the upstream node's `variableName` so AI/messaging nodes can
 * reference the previous node's output. Steps are wired together sequentially.
 */
export function planToGraph(
  plan: WorkflowPlan,
  opts?: PlanToGraphOptions,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const idFactory = opts?.idFactory ?? createId;

  const usedVariableNames = new Set<string>();
  const nodes: GraphNode[] = [];

  let upstreamVarName: string | undefined;

  plan.steps.forEach((step, index) => {
    const type = step.nodeType as NodeType;
    const data = defaultDataForNode(type, { index, upstreamVarName });

    // Ensure variable names are unique across the graph. default-config names
    // by index so collisions are unlikely, but de-dupe defensively.
    const rawVariableName = data.variableName;
    if (typeof rawVariableName === "string") {
      const uniqueVariableName = makeUnique(rawVariableName, usedVariableNames);
      usedVariableNames.add(uniqueVariableName);
      data.variableName = uniqueVariableName;
      upstreamVarName = uniqueVariableName;
    } else {
      upstreamVarName = undefined;
    }

    nodes.push({
      id: idFactory(),
      type,
      position: { x: 0, y: 0 },
      data,
    });
  });

  const positioned = layoutVertical(nodes);

  const edges: GraphEdge[] = [];
  for (let i = 0; i < positioned.length - 1; i++) {
    edges.push({
      id: idFactory(),
      source: positioned[i].id,
      target: positioned[i + 1].id,
    });
  }

  return { nodes: positioned, edges };
}

function makeUnique(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    return name;
  }
  let suffix = 2;
  let candidate = `${name}_${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${name}_${suffix}`;
  }
  return candidate;
}
