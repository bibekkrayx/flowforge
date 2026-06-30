"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getSetupGuideForNode } from "@/features/ai-workflow/setup-guide/guides";
import {
  buildWebhookUrl,
  type WebhookProvider,
} from "@/features/ai-workflow/setup-guide/webhook-url";
import { BookOpen, Check, Clock, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface WorkflowNodeLike {
  id: string;
  type?: string | null;
}

interface SetupGuidePanelProps {
  workflowId: string;
  nodes: WorkflowNodeLike[];
  /** Optional custom trigger; defaults to a "Setup Guide" button. */
  trigger?: React.ReactNode;
}

type ResolvedGuide = NonNullable<ReturnType<typeof getSetupGuideForNode>>;

interface GuideEntry {
  nodeId: string;
  nodeType: string;
  guide: ResolvedGuide;
}

/**
 * Maps a node type to the webhook provider whose inbound URL its copyable
 * setup steps should hand the user. Returns `null` for node types that don't
 * expose an inbound webhook (their copyable steps fall back to the raw detail).
 */
const webhookProviderForNodeType = (
  nodeType: string,
): WebhookProvider | null => {
  if (nodeType.includes("GOOGLE_FORM")) {
    return "google-form";
  }
  if (nodeType.includes("STRIPE")) {
    return "stripe";
  }
  return null;
};

/**
 * Guided "Setup Guide" side panel.
 *
 * Lists, for each integration present in the workflow, its external setup steps
 * (estimated time + numbered instructions). Copyable steps render a copy button
 * that copies the *substituted* webhook URL for the current workflow.
 *
 * Read-only with respect to the canvas — it never mutates nodes or edges.
 */
export const SetupGuidePanel = ({
  workflowId,
  nodes,
  trigger,
}: SetupGuidePanelProps) => {
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  // De-dupe by node type so we show one guide per integration, but keep the
  // first matching node id around for stable keys.
  const seen = new Set<string>();
  const guides: GuideEntry[] = [];

  for (const node of nodes) {
    const nodeType = node.type ?? "";
    if (!nodeType || seen.has(nodeType)) {
      continue;
    }

    const guide = getSetupGuideForNode(nodeType);
    if (!guide) {
      continue;
    }

    seen.add(nodeType);
    guides.push({ nodeId: node.id, nodeType, guide });
  }

  const handleCopy = async (stepKey: string, nodeType: string) => {
    const provider = webhookProviderForNodeType(nodeType);
    if (!provider) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        buildWebhookUrl(provider, workflowId),
      );
      setCopiedStep(stepKey);
      toast.success("Webhook URL copied to clipboard");
      window.setTimeout(() => {
        setCopiedStep((current) => (current === stepKey ? null : current));
      }, 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <BookOpen className="size-4" />
            Setup Guide
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Setup Guide</SheetTitle>
          <SheetDescription>
            Step-by-step external setup for the integrations in this workflow.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 px-4 pb-6">
            {guides.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No external setup is required for this workflow.
              </p>
            ) : (
              guides.map(({ nodeId, nodeType, guide }) => (
                <section key={nodeId} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">
                      {guide.integration}
                    </h3>
                    <Badge variant="outline" className="gap-1">
                      <Clock className="size-3" />~{guide.estimatedMinutes} min
                    </Badge>
                  </div>

                  <ol className="flex flex-col gap-3">
                    {guide.steps.map((step, index) => {
                      const stepKey = `${nodeId}-${index}`;
                      const isCopied = copiedStep === stepKey;
                      const provider = webhookProviderForNodeType(nodeType);
                      const canCopy = step.copyable && provider !== null;

                      return (
                        <li key={stepKey} className="flex gap-3">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                            {index + 1}
                          </span>
                          <div className="flex min-w-0 flex-col gap-1">
                            <p className="text-sm font-medium">{step.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {step.detail}
                            </p>
                            {canCopy && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-1 w-fit"
                                onClick={() => handleCopy(stepKey, nodeType)}
                              >
                                {isCopied ? (
                                  <Check className="size-3.5" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )}
                                {isCopied ? "Copied" : "Copy webhook URL"}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>

                  <Separator />
                </section>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
