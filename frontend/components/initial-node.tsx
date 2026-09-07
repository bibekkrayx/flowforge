"use client";

import { memo } from "react";
import { PlaceholderNode } from "./react-flow/placeholder-node";
import { NodeProps } from "@xyflow/react";
import { PlusIcon } from "lucide-react";
import { WorkflowNode } from "./workflow-node";
import { useSetAtom } from "jotai";
import { nodeSelectorOpenAtom } from "@/features/editor/store/atoms";

export const InitialNode = memo((props: NodeProps) => {
  const setSelectorOpen = useSetAtom(nodeSelectorOpenAtom);

  return (
    <WorkflowNode showToolBar={false}>
      <PlaceholderNode {...props} onClick={() => setSelectorOpen(true)}>
        <div className="cursor-pointer flex items-center justify-center">
          <PlusIcon className="size-4" />
        </div>
      </PlaceholderNode>
    </WorkflowNode>
  );
});

InitialNode.displayName = "InitialNode";
