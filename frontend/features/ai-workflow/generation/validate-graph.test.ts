import { describe, expect, it, vi } from "vitest";
import { NodeType } from "@/generated/prisma/enums";

// Unit 1's node catalog is a sibling module that may not exist on this branch
// pre-merge. Mock it to the documented contract so this unit is testable in
// isolation. The real module supplies the same exports.
vi.mock("@/features/ai-workflow/capabilities/node-catalog", () => {
  const TRIGGER_TYPES = new Set<string>([
    NodeType.MANUAL_TRIGGER,
    NodeType.GOOGLE_FORM_TRIGGER,
    NodeType.STRIPE_TRIGGER,
    NodeType.SCHEDULE_TRIGGER,
    NodeType.EVENT_TRIGGER,
  ]);

  const SUPPORTED_NODE_TYPES = [
    NodeType.MANUAL_TRIGGER,
    NodeType.GOOGLE_FORM_TRIGGER,
    NodeType.STRIPE_TRIGGER,
    NodeType.SCHEDULE_TRIGGER,
    NodeType.EVENT_TRIGGER,
    NodeType.HTTP_REQUEST,
    NodeType.ANTHROPIC,
    NodeType.GEMINI,
    NodeType.OPENAI,
    NodeType.DISCORD,
    NodeType.SLACK,
    NodeType.EMAIL,
    NodeType.GOOGLE_SHEETS,
    NodeType.LOOP,
  ] as const;

  return {
    SUPPORTED_NODE_TYPES,
    getNodeCapability(type: string) {
      if (!SUPPORTED_NODE_TYPES.includes(type as never)) {
        return undefined;
      }
      return {
        type,
        kind: TRIGGER_TYPES.has(type) ? "trigger" : "action",
        requiredConfig: [],
      };
    },
    NODE_CATALOG: SUPPORTED_NODE_TYPES.map((type) => ({
      type,
      kind: TRIGGER_TYPES.has(type) ? "trigger" : "action",
      requiredConfig: [],
    })),
  };
});

import {
  validateGraph,
  type GraphEdge,
  type GraphNode,
} from "./validate-graph";

function node(
  id: string,
  type: NodeType | string,
  data?: Record<string, unknown>,
): GraphNode {
  return { id, type, data };
}

function edge(source: string, target: string): GraphEdge {
  return { source, target };
}

describe("validateGraph", () => {
  it("passes a valid linear trigger → action → action graph", () => {
    const nodes = [
      node("t", NodeType.MANUAL_TRIGGER),
      node("a", NodeType.HTTP_REQUEST),
      node("b", NodeType.DISCORD),
    ];
    const edges = [edge("t", "a"), edge("a", "b")];

    const result = validateGraph(nodes, edges);

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("accepts INITIAL as the entry node", () => {
    const nodes = [
      node("init", NodeType.INITIAL),
      node("a", NodeType.HTTP_REQUEST),
    ];
    const edges = [edge("init", "a")];

    const result = validateGraph(nodes, edges);

    expect(result.ok).toBe(true);
  });

  it("fails when there is no trigger", () => {
    const nodes = [
      node("a", NodeType.HTTP_REQUEST),
      node("b", NodeType.DISCORD),
    ];
    const edges = [edge("a", "b")];

    const result = validateGraph(nodes, edges);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Workflow has no trigger");
  });

  it("fails when there is more than one trigger", () => {
    const nodes = [
      node("t1", NodeType.MANUAL_TRIGGER),
      node("t2", NodeType.SCHEDULE_TRIGGER),
      node("a", NodeType.HTTP_REQUEST),
    ];
    const edges = [edge("t1", "a")];

    const result = validateGraph(nodes, edges);

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.includes("more than one trigger")),
    ).toBe(true);
  });

  it("fails on duplicate variable names", () => {
    const nodes = [
      node("t", NodeType.MANUAL_TRIGGER),
      node("a", NodeType.HTTP_REQUEST, { variableName: "result" }),
      node("b", NodeType.DISCORD, { variableName: "result" }),
    ];
    const edges = [edge("t", "a"), edge("a", "b")];

    const result = validateGraph(nodes, edges);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Duplicate variable name "result"');
    // The duplicate is reported only once.
    expect(
      result.errors.filter((e) => e.includes('"result"')).length,
    ).toBe(1);
  });

  it("fails when a node is orphaned (unreachable from the trigger)", () => {
    const nodes = [
      node("t", NodeType.MANUAL_TRIGGER),
      node("a", NodeType.HTTP_REQUEST),
      node("orphan", NodeType.DISCORD),
    ];
    const edges = [edge("t", "a")];

    const result = validateGraph(nodes, edges);

    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes('"orphan"') && e.includes("not reachable"),
      ),
    ).toBe(true);
  });

  it("fails on an unsupported node type", () => {
    const nodes = [
      node("t", NodeType.MANUAL_TRIGGER),
      node("a", "TELEPORTER"),
    ];
    const edges = [edge("t", "a")];

    const result = validateGraph(nodes, edges);

    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes('"a"') && e.includes("TELEPORTER"),
      ),
    ).toBe(true);
  });

  it("fails when the trigger has an incoming edge (invalid order)", () => {
    const nodes = [
      node("t", NodeType.MANUAL_TRIGGER),
      node("a", NodeType.HTTP_REQUEST),
    ];
    const edges = [edge("t", "a"), edge("a", "t")];

    const result = validateGraph(nodes, edges);

    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes('"t"') && e.includes("incoming edge"),
      ),
    ).toBe(true);
  });
});
