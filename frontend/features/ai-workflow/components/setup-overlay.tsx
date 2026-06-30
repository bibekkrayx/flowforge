"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deriveRequirements } from "@/features/ai-workflow/setup-guide/requirements";
import { useSuspenseWorkflow } from "@/features/workflows/hooks/use-workflows";
import { ListChecks } from "lucide-react";
import { RegenerateButton } from "./regenerate-button";
import { SetupChecklist } from "./setup-checklist";
import { SetupGuidePanel } from "./setup-guide-panel";

interface SetupOverlayProps {
  workflowId: string;
}

/**
 * Non-invasive AI-workflow setup controls for the editor.
 *
 * Floats above the React Flow canvas (it does not render inside or modify the
 * canvas). Surfaces the configuration status, a checklist popover, the guided
 * Setup Guide side panel, and the Regenerate action.
 */
export const SetupOverlay = ({ workflowId }: SetupOverlayProps) => {
  const { data: workflow } = useSuspenseWorkflow(workflowId);
  const nodes = workflow.nodes;

  const { items, status } = deriveRequirements(nodes);
  const isComplete = status === "complete";
  const unsatisfied = items.filter((item) => !item.satisfied).length;

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-background/80 p-1.5 shadow-sm backdrop-blur">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <ListChecks className="size-4" />
              Configuration
              {isComplete ? (
                <Badge variant="secondary">Ready</Badge>
              ) : (
                <Badge variant="destructive">
                  {unsatisfied > 0 ? unsatisfied : "Incomplete"}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <SetupChecklist nodes={nodes} className="border-0 shadow-none" />
          </PopoverContent>
        </Popover>

        <SetupGuidePanel workflowId={workflowId} nodes={nodes} />
        <RegenerateButton workflowId={workflowId} />
      </div>
    </div>
  );
};
