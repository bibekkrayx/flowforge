"use client";

import { ErrorView, LoadingView } from "@/components/entity-components";
import { useSuspenseWorkflow } from "@/features/workflows/hooks/use-workflows";

import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type Connection,
  Background,
  Controls,
  MiniMap,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeComponents } from "@/config/node-components";
import { OpenNodeSelectorButton } from "./open-node-selector-button";
import { useSetAtom, useAtom } from "jotai";
import { editorAtom, nodeSelectorOpenAtom } from "../store/atoms";
import { NodeType } from "@/generated/prisma/enums";
import { ExecuteWorkflowButton } from "./execute-workflow-button";
import { WorkflowExecutionSubscriber } from "@/features/execution/components/workflow-execution-subscriber";
import {
  WorkflowExecutionProvider,
  resolveNodeIdForStatus,
} from "@/features/execution/context/workflow-execution-context";
import type { NodeStatus } from "@/components/react-flow/node-status-indicator";
import { NodeSelector } from "@/components/node-selector";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export const EditorLoading = () => {
  return <LoadingView message="Loading editor..." />;
};

export const EditorError = () => {
  return <ErrorView message="Error loading editor" />;
};

export const Editor = ({ workflowId }: { workflowId: string }) => {
  const { data: workflow } = useSuspenseWorkflow(workflowId);
  const searchParams = useSearchParams();
  const router = useRouter();

  const setEditor = useSetAtom(editorAtom);
  const [selectorOpen, setSelectorOpen] = useAtom(nodeSelectorOpenAtom);

  useEffect(() => {
    if (searchParams.get("openNodeSelector") !== "1") {
      return;
    }

    setSelectorOpen(true);
    router.replace(`/workflows/${workflowId}`, { scroll: false });
  }, [router, searchParams, setSelectorOpen, workflowId]);

  useEffect(() => {
    return () => {
      setSelectorOpen(false);
    };
  }, [setSelectorOpen]);

  const [nodes, setNodes] = useState<Node[]>(workflow.nodes);
  const [edges, setEdges] = useState<Edge[]>(workflow.edges);

  const syncNodeStatus = useCallback(
    (nodeId: string, status: NodeStatus, nodeType?: string) => {
      setNodes((currentNodes) => {
        const targetId = resolveNodeIdForStatus(
          currentNodes,
          nodeId,
          nodeType,
        );

        if (!targetId) return currentNodes;

        return currentNodes.map((node) =>
          node.id === targetId
            ? {
                ...node,
                data: {
                  ...node.data,
                  executionStatus: status,
                },
              }
            : node,
        );
      });
    },
    [],
  );

  const resetAllNodeStatuses = useCallback(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (!node.data?.executionStatus) return node;
        const nextData = { ...node.data };
        delete nextData.executionStatus;
        return { ...node, data: nextData };
      }),
    );
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const hasManualTrigger = useMemo(() => {
    return nodes.some(
      (node) =>
        node.type === NodeType.MANUAL_TRIGGER ||
        node.type === NodeType.INITIAL,
    );
  }, [nodes]);

  const hasScheduleTrigger = useMemo(() => {
    return nodes.some((node) => node.type === NodeType.SCHEDULE_TRIGGER);
  }, [nodes]);

  // A workflow is triggerable if it has any entry-point trigger. A
  // schedule-only workflow is valid and must not be prompted to add a manual
  // trigger. The manual "Execute workflow" button remains gated on
  // hasManualTrigger since a pure schedule cannot be click-run from there.
  const isValidWorkflow = hasManualTrigger || hasScheduleTrigger;

  return (
    <WorkflowExecutionProvider
      syncNodeStatus={syncNodeStatus}
      resetAllNodeStatuses={resetAllNodeStatuses}
    >
      <div
        className="size-full min-h-0"
        data-workflow-valid={isValidWorkflow}
      >
        <WorkflowExecutionSubscriber workflowId={workflowId} />
        <ReactFlow
          colorMode="dark"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeComponents}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setEditor}
          fitView
          snapGrid={[10, 10]}
          snapToGrid
          panOnScroll
          panOnDrag={false}
          selectionOnDrag
          defaultEdgeOptions={{
            style: { stroke: "var(--color-primary)" },
          }}
          proOptions={{
            hideAttribution: true,
          }}
        >
          <NodeSelector open={selectorOpen} onOpenChange={setSelectorOpen} />
          <Background gap={12} size={1} color="var(--color-border)" />
          <Controls className="bg-background border-border [&_button]:bg-background [&_button]:border-b-border [&_button:hover]:bg-muted [&_svg]:fill-foreground" />
          <MiniMap
            className="bg-background border-border"
            nodeColor="var(--color-primary)"
            maskColor="var(--color-muted)"
          />
          <Panel position="top-left" className="m-2">
            <OpenNodeSelectorButton
              label="Add node"
              className="bg-background/80 shadow-sm backdrop-blur"
            />
          </Panel>
          {hasManualTrigger && (
            <Panel position="bottom-center" className="mb-4">
              <ExecuteWorkflowButton workflowId={workflowId} />
            </Panel>
          )}
        </ReactFlow>
      </div>
    </WorkflowExecutionProvider>
  );
};
