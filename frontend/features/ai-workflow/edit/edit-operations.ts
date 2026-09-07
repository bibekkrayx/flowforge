import { createId } from "@paralleldrive/cuid2";

import type { NodeType } from "@/generated/prisma/enums";
import { defaultDataForNode } from "@/features/ai-workflow/generation/default-config";
import { layoutVertical } from "@/features/ai-workflow/generation/layout";

/**
 * A workflow graph node in the AI-workflow editing format.
 *
 * `data` is an opaque, node-type-specific config bag (e.g. it may carry a
 * `variableName` that downstream nodes reference). Editing operations preserve
 * `variableName` across type changes so existing references keep resolving.
 */
export type GraphNode = {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

/** A directed edge between two nodes. `id` is optional until persisted. */
export type GraphEdge = {
  id?: string;
  source: string;
  target: string;
};

/** A complete editable workflow graph. */
export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/** Factory for new node/edge ids. Override in tests for determinism. */
type IdFactory = () => string;

type BaseOpts = {
  idFactory?: IdFactory;
};

/**
 * Declarative "Edit with AI" intents. A natural-language request
 * ("Replace OpenAI with Gemini", "Add Slack", "Insert HTTP Request") is parsed
 * into one of these operations and applied via {@link applyEditOperation}.
 */
export type EditOperation =
  | { kind: "replace"; nodeId: string; newType: NodeType }
  | { kind: "add"; nodeType: NodeType; afterNodeId?: string }
  | { kind: "insert"; nodeType: NodeType; sourceId: string; targetId: string }
  | { kind: "remove"; nodeId: string };

function variableNameOf(node: GraphNode): string | undefined {
  const value = node.data.variableName;
  return typeof value === "string" ? value : undefined;
}

/** Index of a node within `graph.nodes`. Throws if the node is absent. */
function nodeIndex(graph: Graph, nodeId: string): number {
  const index = graph.nodes.findIndex((node) => node.id === nodeId);
  if (index === -1) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  return index;
}

function makeEdge(source: string, target: string, idFactory: IdFactory): GraphEdge {
  return { id: idFactory(), source, target };
}

/**
 * Swap a node's type in place: keep its id and connected edges, regenerate its
 * `data` for the new type, and preserve any existing `variableName` so
 * downstream references keep working.
 */
export function replaceNode(
  graph: Graph,
  nodeId: string,
  newType: NodeType,
  opts: BaseOpts = {},
): Graph {
  void opts;
  const index = nodeIndex(graph, nodeId);
  const existing = graph.nodes[index];
  const variableName = variableNameOf(existing);

  const data: Record<string, unknown> = {
    ...defaultDataForNode(newType, { index }),
  };
  if (variableName !== undefined) {
    data.variableName = variableName;
  } else {
    delete data.variableName;
  }

  const nodes = graph.nodes.map((node, i) =>
    i === index ? { ...node, type: newType, data } : node,
  );

  return {
    nodes,
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
}

/**
 * Append a new node of `type`. If `afterNodeId` is given, the new node is
 * spliced into the chain after it (rewiring `after → oldTarget` into
 * `after → new → oldTarget`); otherwise it is appended at the end of the chain.
 * Layout is re-run so positions stay consistent.
 */
export function addNode(
  graph: Graph,
  type: NodeType,
  opts: BaseOpts & { afterNodeId?: string } = {},
): Graph {
  const idFactory = opts.idFactory ?? createId;
  const newId = idFactory();
  const newNode: GraphNode = {
    id: newId,
    type,
    position: { x: 0, y: 0 },
    data: { ...defaultDataForNode(type, { index: graph.nodes.length }) },
  };

  const nodes = [...graph.nodes, newNode];
  const edges: GraphEdge[] = [];

  if (opts.afterNodeId !== undefined) {
    // Validate the anchor exists before rewiring.
    nodeIndex(graph, opts.afterNodeId);
    const outgoing = graph.edges.find((edge) => edge.source === opts.afterNodeId);

    for (const edge of graph.edges) {
      // Rewire `after → oldTarget` to start from the new node instead.
      edges.push(edge === outgoing ? { ...edge, source: newId } : { ...edge });
    }
    edges.push(makeEdge(opts.afterNodeId, newId, idFactory));
  } else {
    for (const edge of graph.edges) {
      edges.push({ ...edge });
    }
    const tail = findChainTail(graph);
    if (tail !== undefined) {
      edges.push(makeEdge(tail, newId, idFactory));
    }
  }

  return { nodes: layoutVertical(nodes), edges };
}

/**
 * Insert a new node onto an existing `source → target` edge: remove that edge
 * and replace it with `source → new` and `new → target`. Layout is re-run.
 */
export function insertNodeBetween(
  graph: Graph,
  type: NodeType,
  sourceId: string,
  targetId: string,
  opts: BaseOpts = {},
): Graph {
  const idFactory = opts.idFactory ?? createId;
  const newId = idFactory();
  const newNode: GraphNode = {
    id: newId,
    type,
    position: { x: 0, y: 0 },
    data: { ...defaultDataForNode(type, { index: graph.nodes.length }) },
  };

  const nodes = [...graph.nodes, newNode];
  const edges = graph.edges
    .filter((edge) => !(edge.source === sourceId && edge.target === targetId))
    .map((edge) => ({ ...edge }));
  edges.push(makeEdge(sourceId, newId, idFactory), makeEdge(newId, targetId, idFactory));

  return { nodes: layoutVertical(nodes), edges };
}

/**
 * Remove a node. If it had exactly one upstream and one downstream neighbour,
 * reconnect them so the chain stays intact. All edges touching the node are
 * dropped. Layout is re-run.
 */
export function removeNode(graph: Graph, nodeId: string, opts: BaseOpts = {}): Graph {
  const idFactory = opts.idFactory ?? createId;
  nodeIndex(graph, nodeId);

  const upstream = graph.edges.filter((edge) => edge.target === nodeId);
  const downstream = graph.edges.filter((edge) => edge.source === nodeId);

  const nodes = graph.nodes.filter((node) => node.id !== nodeId);
  const edges = graph.edges
    .filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    .map((edge) => ({ ...edge }));

  if (upstream.length === 1 && downstream.length === 1) {
    edges.push(makeEdge(upstream[0].source, downstream[0].target, idFactory));
  }

  return { nodes: layoutVertical(nodes), edges };
}

/**
 * Apply a declarative {@link EditOperation} to a graph, returning a new graph.
 * This is the single entry point for wiring parsed "Edit with AI" intents.
 */
export function applyEditOperation(
  graph: Graph,
  op: EditOperation,
  opts: BaseOpts = {},
): Graph {
  switch (op.kind) {
    case "replace":
      return replaceNode(graph, op.nodeId, op.newType, opts);
    case "add":
      return addNode(graph, op.nodeType, { ...opts, afterNodeId: op.afterNodeId });
    case "insert":
      return insertNodeBetween(graph, op.nodeType, op.sourceId, op.targetId, opts);
    case "remove":
      return removeNode(graph, op.nodeId, opts);
    default: {
      const exhaustive: never = op;
      throw new Error(`Unknown edit operation: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * The tail of a linear chain: the last node with no outgoing edge. Falls back
 * to the last node when the graph has no such node (e.g. a cycle) and to
 * undefined for an empty graph.
 */
function findChainTail(graph: Graph): string | undefined {
  if (graph.nodes.length === 0) {
    return undefined;
  }
  const sources = new Set(graph.edges.map((edge) => edge.source));
  for (let i = graph.nodes.length - 1; i >= 0; i--) {
    const node = graph.nodes[i];
    if (!sources.has(node.id)) {
      return node.id;
    }
  }
  return graph.nodes[graph.nodes.length - 1].id;
}
