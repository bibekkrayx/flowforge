"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useGenerateWorkflow } from "@/features/ai-workflow/hooks/use-generate-workflow";
import {
  categorizeSteps,
  estimateManualSteps,
  type StepCategory,
} from "@/features/ai-workflow/lib/step-grouping";
import type { WorkflowPlan } from "@/features/ai-workflow/schemas/plan";
import {
  ArrowDownIcon,
  BotIcon,
  CheckCircle2Icon,
  KeyIcon,
  ListChecksIcon,
  MessageSquareIcon,
  SettingsIcon,
  SparklesIcon,
  XCircleIcon,
  ZapIcon,
} from "lucide-react";

const CATEGORY_ICON: Record<StepCategory, typeof ZapIcon> = {
  trigger: ZapIcon,
  ai: BotIcon,
  messaging: MessageSquareIcon,
  logic: SparklesIcon,
  action: SettingsIcon,
};

type WorkflowPreviewProps = {
  plan: WorkflowPlan;
  onCancel: () => void;
};

export const WorkflowPreview = ({ plan, onCancel }: WorkflowPreviewProps) => {
  const generateWorkflow = useGenerateWorkflow();
  const steps = categorizeSteps(plan.steps);
  const requirements = [
    ...plan.requiredCredentials.map((label) => ({
      label,
      kind: "credential" as const,
    })),
    ...plan.requiredConfiguration.map((label) => ({
      label,
      kind: "configuration" as const,
    })),
  ];
  const manualStepCount = estimateManualSteps(plan);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-base font-medium">
          {plan.workflowName}
        </h3>
        <p className="text-sm text-muted-foreground">
          Review the plan before generating your workflow.
        </p>
      </div>

      <StatusRow plan={plan} />

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Steps
        </p>
        <div className="flex flex-col gap-2">
          {steps.map((step, index) => {
            const Icon = CATEGORY_ICON[step.category];
            return (
              <div key={`${step.title}-${index}`} className="flex flex-col">
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium leading-tight">
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="flex justify-center py-1 text-muted-foreground">
                    <ArrowDownIcon className="size-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {requirements.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Requirements
          </p>
          <ul className="flex flex-col gap-1.5">
            {requirements.map((requirement, index) => (
              <li
                key={`${requirement.label}-${index}`}
                className="flex items-center gap-2 text-sm"
              >
                {requirement.kind === "credential" ? (
                  <KeyIcon className="size-4 text-muted-foreground" />
                ) : (
                  <SettingsIcon className="size-4 text-muted-foreground" />
                )}
                <span>{requirement.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <ListChecksIcon className="size-4 text-muted-foreground" />
        <p className="text-sm">
          Estimated Manual Steps:{" "}
          <span className="font-medium">{manualStepCount}</span>
        </p>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={generateWorkflow.isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={() => generateWorkflow.mutate({ plan })}
          disabled={!plan.possible || generateWorkflow.isPending}
        >
          {generateWorkflow.isPending && <Spinner />}
          Generate Workflow
        </Button>
      </div>
    </div>
  );
};

const StatusRow = ({ plan }: { plan: WorkflowPlan }) => {
  if (plan.possible) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <CheckCircle2Icon className="size-4 text-primary" />
        <span className="font-medium text-primary">Supported</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <div className="flex items-center gap-2">
        <XCircleIcon className="size-4 text-destructive" />
        <span className="font-medium text-destructive">Not supported</span>
      </div>
      {plan.reason && (
        <p className="text-muted-foreground">{plan.reason}</p>
      )}
      {plan.suggestions && plan.suggestions.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
          {plan.suggestions.map((suggestion, index) => (
            <li key={`${suggestion}-${index}`} className={cn("text-xs")}>
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
