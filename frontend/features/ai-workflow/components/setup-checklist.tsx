"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { deriveRequirements } from "@/features/ai-workflow/setup-guide/requirements";
import { cn } from "@/lib/utils";
import { CheckCircle2, CircleAlert } from "lucide-react";

interface WorkflowNodeLike {
  id: string;
  type?: string | null;
  data?: unknown;
}

interface SetupChecklistProps {
  nodes: WorkflowNodeLike[];
  className?: string;
}

/**
 * Renders the AI-workflow configuration checklist for the open editor.
 *
 * Surfaces every requirement derived from the workflow's nodes (credentials,
 * webhook URLs, form ids, …) and shows an at-a-glance status badge:
 * "Configuration Incomplete" until everything is satisfied, then "Ready".
 *
 * Purely presentational + read-only — it never mutates the canvas.
 */
export const SetupChecklist = ({ nodes, className }: SetupChecklistProps) => {
  const { items, status } = deriveRequirements(nodes);
  const isComplete = status === "complete";

  const satisfiedCount = items.filter((item) => item.satisfied).length;

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Setup checklist</CardTitle>
          {isComplete ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3.5" />
              Ready
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <CircleAlert className="size-3.5" />
              Configuration Incomplete
            </Badge>
          )}
        </div>
        <CardDescription>
          {items.length === 0
            ? "No external configuration required for this workflow."
            : `${satisfiedCount} of ${items.length} requirement${
                items.length === 1 ? "" : "s"
              } configured.`}
        </CardDescription>
      </CardHeader>

      {items.length > 0 && (
        <CardContent>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.nodeId} className="flex items-start gap-3">
                <Checkbox
                  checked={item.satisfied}
                  disabled
                  aria-label={
                    item.satisfied
                      ? `${item.label} configured`
                      : `${item.label} not configured`
                  }
                  className="mt-0.5"
                />
                <div className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "text-sm",
                      item.satisfied
                        ? "text-muted-foreground line-through"
                        : "text-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {item.kind}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
};
