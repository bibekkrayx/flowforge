import { describe, expect, it } from "vitest";

import { NodeType } from "@/generated/prisma/enums";

import {
  type EditOperation,
  type Graph,
  addNode,
  applyEditOperation,
  insertNodeBetween,
  removeNode,
  replaceNode,
} from "./edit-operations";

/** Deterministic, monotonically increasing id factory for assertions. */
function stubIdFactory(prefix = "gen") {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

function lineGraph(): Graph {
  return {
    nodes: [
      { id: "a", type: NodeType.MANUAL_TRIGGER, position: { x: 0, y: 0 }, data: {} },
      {
        id: "b",
        type: NodeType.OPENAI,
        position: { x: 0, y: 100 },
        data: { variableName: "aiResult", prompt: "hello" },
      },
      { id: "c", type: NodeType.EMAIL, position: { x: 0, y: 200 }, data: {} },
    ],
    edges: [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
    ],
  };
}

function snapshot(graph: Graph): string {
  return JSON.stringify(graph);
}

describe("replaceNode", () => {
  it("swaps OPENAI to GEMINI keeping id, edges and variableName", () => {
    const graph = lineGraph();
    const result = replaceNode(graph, "b", NodeType.GEMINI);

    const replaced = result.nodes.find((node) => node.id === "b");
    expect(replaced).toBeDefined();
    expect(replaced?.type).toBe(NodeType.GEMINI);
    expect(replaced?.data.variableName).toBe("aiResult");

    // Edges around the node are untouched.
    expect(result.edges).toEqual([
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
    ]);
  });

  it("does not preserve variableName when the original lacks one", () => {
    const graph = lineGraph();
    const result = replaceNode(graph, "a", NodeType.HTTP_REQUEST);
    const replaced = result.nodes.find((node) => node.id === "a");
    expect(replaced?.data.variableName).toBeUndefined();
  });

  it("does not mutate the input graph", () => {
    const graph = lineGraph();
    const before = snapshot(graph);
    replaceNode(graph, "b", NodeType.GEMINI);
    expect(snapshot(graph)).toBe(before);
  });
});

describe("addNode", () => {
  it("rewires edges when added after a node", () => {
    const graph = lineGraph();
    const idFactory = stubIdFactory("new");
    const result = addNode(graph, NodeType.SLACK, {
      afterNodeId: "b",
      idFactory,
    });

    // First generated id is the new node.
    const newNode = result.nodes.find((node) => node.id === "new-0");
    expect(newNode).toBeDefined();
    expect(newNode?.type).toBe(NodeType.SLACK);

    // b → c becomes new → c, and a new b → new edge is added.
    const sourcesOf = (target: string) =>
      result.edges.filter((edge) => edge.target === target).map((edge) => edge.source);
    expect(sourcesOf("c")).toEqual(["new-0"]);
    expect(sourcesOf("new-0")).toEqual(["b"]);
    // a → b is preserved.
    expect(result.edges.some((edge) => edge.source === "a" && edge.target === "b")).toBe(
      true,
    );
  });

  it("appends to the chain tail when no afterNodeId is given", () => {
    const graph = lineGraph();
    const idFactory = stubIdFactory("new");
    const result = addNode(graph, NodeType.SLACK, { idFactory });

    expect(result.nodes).toHaveLength(4);
    // Tail was c (no outgoing edge), so c → new is added.
    expect(
      result.edges.some((edge) => edge.source === "c" && edge.target === "new-0"),
    ).toBe(true);
  });

  it("does not mutate the input graph", () => {
    const graph = lineGraph();
    const before = snapshot(graph);
    addNode(graph, NodeType.SLACK, { afterNodeId: "b", idFactory: stubIdFactory() });
    expect(snapshot(graph)).toBe(before);
  });
});

describe("insertNodeBetween", () => {
  it("splits the source→target edge with a new node", () => {
    const graph = lineGraph();
    const idFactory = stubIdFactory("new");
    const result = insertNodeBetween(graph, NodeType.HTTP_REQUEST, "b", "c", {
      idFactory,
    });

    const newNode = result.nodes.find((node) => node.id === "new-0");
    expect(newNode?.type).toBe(NodeType.HTTP_REQUEST);

    // Direct b → c edge is gone.
    expect(
      result.edges.some((edge) => edge.source === "b" && edge.target === "c"),
    ).toBe(false);
    // Replaced by b → new and new → c.
    expect(
      result.edges.some((edge) => edge.source === "b" && edge.target === "new-0"),
    ).toBe(true);
    expect(
      result.edges.some((edge) => edge.source === "new-0" && edge.target === "c"),
    ).toBe(true);
  });

  it("does not mutate the input graph", () => {
    const graph = lineGraph();
    const before = snapshot(graph);
    insertNodeBetween(graph, NodeType.HTTP_REQUEST, "b", "c", {
      idFactory: stubIdFactory(),
    });
    expect(snapshot(graph)).toBe(before);
  });
});

describe("removeNode", () => {
  it("reconnects neighbours when removing a middle node", () => {
    const graph = lineGraph();
    const result = removeNode(graph, "b", { idFactory: stubIdFactory("new") });

    expect(result.nodes.some((node) => node.id === "b")).toBe(false);
    // No dangling edges referencing b.
    expect(
      result.edges.some((edge) => edge.source === "b" || edge.target === "b"),
    ).toBe(false);
    // a → c reconnection.
    expect(
      result.edges.some((edge) => edge.source === "a" && edge.target === "c"),
    ).toBe(true);
  });

  it("drops dangling edges without reconnecting a fan-out node", () => {
    const graph: Graph = {
      nodes: [
        { id: "a", type: NodeType.MANUAL_TRIGGER, position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: NodeType.OPENAI, position: { x: 0, y: 100 }, data: {} },
        { id: "c", type: NodeType.EMAIL, position: { x: 0, y: 200 }, data: {} },
        { id: "d", type: NodeType.SLACK, position: { x: 0, y: 300 }, data: {} },
      ],
      edges: [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
        { source: "b", target: "d" },
      ],
    };
    const result = removeNode(graph, "b");
    // b had two downstreams, so no auto-reconnect; all edges touching b dropped.
    expect(result.edges).toHaveLength(0);
  });

  it("does not mutate the input graph", () => {
    const graph = lineGraph();
    const before = snapshot(graph);
    removeNode(graph, "b");
    expect(snapshot(graph)).toBe(before);
  });
});

describe("applyEditOperation", () => {
  it("dispatches replace", () => {
    const graph = lineGraph();
    const op: EditOperation = { kind: "replace", nodeId: "b", newType: NodeType.GEMINI };
    const result = applyEditOperation(graph, op);
    expect(result.nodes.find((node) => node.id === "b")?.type).toBe(NodeType.GEMINI);
  });

  it("dispatches add", () => {
    const graph = lineGraph();
    const op: EditOperation = { kind: "add", nodeType: NodeType.SLACK, afterNodeId: "b" };
    const result = applyEditOperation(graph, op, { idFactory: stubIdFactory("new") });
    expect(result.nodes).toHaveLength(4);
  });

  it("dispatches insert", () => {
    const graph = lineGraph();
    const op: EditOperation = {
      kind: "insert",
      nodeType: NodeType.HTTP_REQUEST,
      sourceId: "b",
      targetId: "c",
    };
    const result = applyEditOperation(graph, op, { idFactory: stubIdFactory("new") });
    expect(
      result.edges.some((edge) => edge.source === "b" && edge.target === "c"),
    ).toBe(false);
  });

  it("dispatches remove", () => {
    const graph = lineGraph();
    const op: EditOperation = { kind: "remove", nodeId: "b" };
    const result = applyEditOperation(graph, op);
    expect(result.nodes.some((node) => node.id === "b")).toBe(false);
  });
});
