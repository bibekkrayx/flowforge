import { createId } from "@paralleldrive/cuid2";
import { NodeType } from "@/generated/prisma/enums";
import {
  executionNodeMetadata,
  triggerNodeMetadata,
  type NodeTypeMetadata,
} from "@/config/node-type-metadata";
import {
  CalendarClockIcon,
  ClockIcon,
  GlobeIcon,
  MailIcon,
  MousePointerIcon,
  RepeatIcon,
  SheetIcon,
} from "lucide-react";
import { ReactNode, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import Image from "next/image";
import { Separator } from "./ui/separator";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";

export type NodeTypeOption = NodeTypeMetadata & {
  icon: React.ComponentType<{ className?: string }> | string;
};

const TRIGGER_ICONS: Partial<
  Record<NodeType, React.ComponentType<{ className?: string }> | string>
> = {
  [NodeType.MANUAL_TRIGGER]: MousePointerIcon,
  [NodeType.GOOGLE_FORM_TRIGGER]: `/logos/googleform.svg`,
  [NodeType.STRIPE_TRIGGER]: "/logos/stripe.svg",
  [NodeType.SCHEDULE_TRIGGER]: ClockIcon,
  [NodeType.EVENT_TRIGGER]: CalendarClockIcon,
  [NodeType.GEMINI]: "/logos/gemini.svg",
  [NodeType.OPENAI]: "/logos/openai.svg",
  [NodeType.ANTHROPIC]: "/logos/anthropic.svg",
  [NodeType.DISCORD]: "/logos/discord.svg",
  [NodeType.SLACK]: "/logos/slack.svg",
};

const EXECUTION_ICONS: Partial<
  Record<NodeType, React.ComponentType<{ className?: string }> | string>
> = {
  [NodeType.HTTP_REQUEST]: GlobeIcon,
  [NodeType.LOOP]: RepeatIcon,
  [NodeType.EMAIL]: MailIcon,
  [NodeType.GOOGLE_SHEETS]: SheetIcon,
};

function withIcon(
  metadata: NodeTypeMetadata,
  icons: Partial<
    Record<NodeType, React.ComponentType<{ className?: string }> | string>
  >,
): NodeTypeOption {
  const icon = icons[metadata.type];
  if (!icon) {
    throw new Error(`Missing icon for node type "${metadata.type}"`);
  }
  return { ...metadata, icon };
}

export const triggerNodes: NodeTypeOption[] = triggerNodeMetadata.map((node) =>
  withIcon(node, TRIGGER_ICONS),
);

export const executionNodes: NodeTypeOption[] = executionNodeMetadata.map(
  (node) => withIcon(node, EXECUTION_ICONS),
);

interface NodeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}

export function NodeSelector({
  open,
  onOpenChange,
  children,
}: NodeSelectorProps) {
  const { setNodes, getNodes, screenToFlowPosition } = useReactFlow();

  const handleNodeSelect = useCallback(
    (selection: NodeTypeOption) => {
      // Check if trying to add a manual trigger when one already exists
      if (selection.type === NodeType.MANUAL_TRIGGER) {
        const nodes = getNodes();
        const hasManualTrigger = nodes.some(
          (node) => node.type === NodeType.MANUAL_TRIGGER,
        );

        if (hasManualTrigger) {
          toast.error("Only one manual trigger is allowed per workflow");
          return;
        }
      }

      // Check if trying to add a schedule trigger when one already exists
      if (selection.type === NodeType.SCHEDULE_TRIGGER) {
        const nodes = getNodes();
        const hasScheduleTrigger = nodes.some(
          (node) => node.type === NodeType.SCHEDULE_TRIGGER,
        );

        if (hasScheduleTrigger) {
          toast.error("Only one schedule trigger is allowed per workflow");
          return;
        }
      }

      // Check if trying to add an event trigger when one already exists
      if (selection.type === NodeType.EVENT_TRIGGER) {
        const nodes = getNodes();
        const hasEventTrigger = nodes.some(
          (node) => node.type === NodeType.EVENT_TRIGGER,
        );

        if (hasEventTrigger) {
          toast.error("Only one event reminder trigger is allowed per workflow");
          return;
        }
      }

      setNodes((nodes) => {
        const hasInitialTrigger = nodes.some(
          (node) => node.type === NodeType.INITIAL,
        );

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const flowPosition = screenToFlowPosition({
          x: centerX + (Math.random() - 0.5) * 200,
          y: centerY + (Math.random() - 0.5) * 200,
        });

        const newNode = {
          id: createId(),
          data: {},
          position: flowPosition,
          type: selection.type,
        };

        if (hasInitialTrigger) {
          return [newNode];
        }

        return [...nodes, newNode];
      });

      onOpenChange(false);
    },
    [setNodes, getNodes, onOpenChange, screenToFlowPosition],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children ? <SheetTrigger asChild>{children}</SheetTrigger> : null}
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>What triggers this workflow?</SheetTitle>
          <SheetDescription>
            A trigger is a step that starts your workflow.
          </SheetDescription>
        </SheetHeader>
        <div>
          {triggerNodes.map((nodeType) => {
            const Icon = nodeType.icon;
            return (
              <div
                key={nodeType.type}
                className="w-full justify-start h-auto py-5 px-4 rounded-none cursor-pointer border-l-2 border-transparent hover:border-l-primary"
                onClick={() => {
                  handleNodeSelect(nodeType);
                }}
              >
                <div className="flex items-center gap-6 w-full overflow-hidden">
                  {typeof Icon === "string" ? (
                    <Image
                      src={Icon}
                      alt={nodeType.label}
                      width={20}
                      height={20}
                      className="size-5 object-contain rounded-sm"
                    />
                  ) : (
                    <Icon className="size-5" />
                  )}
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium text-sm">
                      {nodeType.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {nodeType.description}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <Separator />
        <div>
          {executionNodes.map((nodeType) => {
            const Icon = nodeType.icon;
            return (
              <div
                key={nodeType.type}
                className="w-full justify-start h-auto py-5 px-4 rounded-none cursor-pointer border-l-2 border-transparent hover:border-l-primary"
                onClick={() => {
                  handleNodeSelect(nodeType);
                }}
              >
                <div className="flex items-center gap-6 w-full overflow-hidden">
                  {typeof Icon === "string" ? (
                    <Image
                      src={Icon}
                      alt={nodeType.label}
                      className="size-5 object-contain rounded-sm"
                    />
                  ) : (
                    <Icon className="size-5" />
                  )}
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium text-sm">
                      {nodeType.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {nodeType.description}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
