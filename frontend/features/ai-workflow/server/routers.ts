import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Node, Edge } from "@xyflow/react";
import type { Prisma } from "@/generated/prisma/client";
import { NodeType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  createTRPCRouter,
  premiumProcedure,
  protectedProcedure,
} from "@/trpc/init";
import { PlannerInputSchema, WorkflowPlanSchema } from "@/features/ai-workflow/schemas/plan";
import { planWorkflow } from "@/features/ai-workflow/service/planner.service";
import { planToGraph } from "@/features/ai-workflow/generation/plan-to-graph";
import { validateGraph } from "@/features/ai-workflow/generation/validate-graph";

/**
 * Map a react-flow node into the Prisma `node.createMany` shape, mirroring the
 * persistence used by `workflows.update`. The node's `name` defaults to its
 * type, matching how generated workflows label nodes.
 */
function toNodeCreateData(
  workflowId: string,
  node: Node,
): Prisma.NodeCreateManyInput {
  return {
    id: node.id,
    workflowId,
    name: node.type || "unknown",
    type: node.type as NodeType,
    position: node.position,
    data: (node.data as Prisma.InputJsonValue) ?? {},
  };
}

/**
 * Map react-flow edges into the Prisma `connection.createMany` shape, deduping
 * by `source|target|fromOutput|toInput` exactly like `workflows.update`.
 */
function toConnectionCreateData(
  workflowId: string,
  edges: Edge[],
): Prisma.ConnectionCreateManyInput[] {
  const uniqueEdges = new Map<string, Edge>();

  for (const edge of edges) {
    const fromOutput = edge.sourceHandle || "main";
    const toInput = edge.targetHandle || "main";
    const key = `${edge.source}|${edge.target}|${fromOutput}|${toInput}`;
    uniqueEdges.set(key, edge);
  }

  return [...uniqueEdges.values()].map((edge) => ({
    workflowId,
    fromNodeId: edge.source,
    toNodeId: edge.target,
    fromOutput: edge.sourceHandle || "main",
    toInput: edge.targetHandle || "main",
  }));
}

/**
 * Create a workflow and persist its nodes/connections in a single transaction,
 * mirroring `workflows.create` + `workflows.update`. Returns the new workflow id.
 */
export async function persistGeneratedWorkflow(input: {
  name: string;
  userId: string;
  nodes: Node[];
  edges: Edge[];
}): Promise<{ workflowId: string }> {
  const { name, userId, nodes, edges } = input;

  return prisma.$transaction(async (tx) => {
    const workflow = await tx.workflow.create({
      data: { name, userId },
    });

    if (nodes.length > 0) {
      await tx.node.createMany({
        data: nodes.map((node) => toNodeCreateData(workflow.id, node)),
      });
    }

    const connections = toConnectionCreateData(workflow.id, edges);
    if (connections.length > 0) {
      await tx.connection.createMany({ data: connections });
    }

    return { workflowId: workflow.id };
  });
}

export const aiWorkflowRouter = createTRPCRouter({
  plan: protectedProcedure
    .input(PlannerInputSchema)
    .mutation(({ input }) => planWorkflow({ prompt: input.prompt })),

  generate: premiumProcedure
    .input(z.object({ plan: WorkflowPlanSchema }))
    .mutation(async ({ ctx, input }) => {
      const { plan } = input;

      if (!plan.possible) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: plan.reason,
        });
      }

      const { nodes, edges } = planToGraph(plan);

      const check = validateGraph(nodes, edges);
      if (!check.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: check.errors.join("; "),
        });
      }

      return persistGeneratedWorkflow({
        name: plan.workflowName,
        userId: ctx.auth.user.id,
        nodes,
        edges,
      });
    }),
});
