import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Node, Edge } from "@xyflow/react";

vi.mock("server-only", () => ({}));

const txMock = {
  workflow: { create: vi.fn() },
  node: { createMany: vi.fn() },
  connection: { createMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
  },
}));

// Sibling modules (Units 2/4/5/8) are mocked so this unit's logic can be tested
// in isolation against the documented contracts.
vi.mock("@/features/ai-workflow/schemas/plan", () => ({
  PlannerInputSchema: {},
  WorkflowPlanSchema: {},
}));
vi.mock("@/features/ai-workflow/service/planner.service", () => ({
  planWorkflow: vi.fn(),
}));
vi.mock("@/features/ai-workflow/generation/plan-to-graph", () => ({
  planToGraph: vi.fn(),
}));
vi.mock("@/features/ai-workflow/generation/validate-graph", () => ({
  validateGraph: vi.fn(),
}));

vi.mock("@/trpc/init", () => {
  const passthrough = {
    input: () => passthrough,
    mutation: (fn: unknown) => fn,
  };
  return {
    createTRPCRouter: (routes: unknown) => routes,
    protectedProcedure: passthrough,
    premiumProcedure: passthrough,
  };
});

import { persistGeneratedWorkflow } from "@/features/ai-workflow/server/routers";

describe("persistGeneratedWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.workflow.create.mockResolvedValue({ id: "wf_1" });
  });

  it("creates the workflow with name + userId and returns the new id", async () => {
    const result = await persistGeneratedWorkflow({
      name: "My Flow",
      userId: "user_1",
      nodes: [],
      edges: [],
    });

    expect(txMock.workflow.create).toHaveBeenCalledWith({
      data: { name: "My Flow", userId: "user_1" },
    });
    expect(result).toEqual({ workflowId: "wf_1" });
  });

  it("maps nodes into createMany shape, defaulting name to type and data to {}", async () => {
    const nodes: Node[] = [
      {
        id: "n1",
        type: "INITIAL",
        position: { x: 0, y: 0 },
        data: { foo: "bar" },
      },
      {
        id: "n2",
        type: "INITIAL",
        position: { x: 10, y: 20 },
        data: {},
      },
    ];

    await persistGeneratedWorkflow({
      name: "f",
      userId: "u",
      nodes,
      edges: [],
    });

    expect(txMock.node.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: "n1",
          workflowId: "wf_1",
          name: "INITIAL",
          type: "INITIAL",
          position: { x: 0, y: 0 },
          data: { foo: "bar" },
        },
        {
          id: "n2",
          workflowId: "wf_1",
          name: "INITIAL",
          type: "INITIAL",
          position: { x: 10, y: 20 },
          data: {},
        },
      ],
    });
  });

  it("does not call node.createMany when there are no nodes", async () => {
    await persistGeneratedWorkflow({
      name: "f",
      userId: "u",
      nodes: [],
      edges: [],
    });
    expect(txMock.node.createMany).not.toHaveBeenCalled();
  });

  it("maps edges into connection shape with main handle defaults", async () => {
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b" },
    ];

    await persistGeneratedWorkflow({
      name: "f",
      userId: "u",
      nodes: [],
      edges,
    });

    expect(txMock.connection.createMany).toHaveBeenCalledWith({
      data: [
        {
          workflowId: "wf_1",
          fromNodeId: "a",
          toNodeId: "b",
          fromOutput: "main",
          toInput: "main",
        },
      ],
    });
  });

  it("preserves explicit source/target handles", async () => {
    const edges: Edge[] = [
      {
        id: "e1",
        source: "a",
        target: "b",
        sourceHandle: "out1",
        targetHandle: "in2",
      },
    ];

    await persistGeneratedWorkflow({
      name: "f",
      userId: "u",
      nodes: [],
      edges,
    });

    expect(txMock.connection.createMany).toHaveBeenCalledWith({
      data: [
        {
          workflowId: "wf_1",
          fromNodeId: "a",
          toNodeId: "b",
          fromOutput: "out1",
          toInput: "in2",
        },
      ],
    });
  });

  it("dedupes edges by source|target|fromOutput|toInput", async () => {
    const edges: Edge[] = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "a", target: "b" },
      { id: "e3", source: "a", target: "b", sourceHandle: "alt" },
    ];

    await persistGeneratedWorkflow({
      name: "f",
      userId: "u",
      nodes: [],
      edges,
    });

    const call = txMock.connection.createMany.mock.calls[0][0];
    expect(call.data).toHaveLength(2);
  });

  it("skips connection.createMany when there are no edges", async () => {
    await persistGeneratedWorkflow({
      name: "f",
      userId: "u",
      nodes: [],
      edges: [],
    });
    expect(txMock.connection.createMany).not.toHaveBeenCalled();
  });
});
