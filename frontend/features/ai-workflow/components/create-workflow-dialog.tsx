"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AiPromptInput,
  type AiPromptPhase,
} from "@/features/ai-workflow/components/ai-prompt-input";
import { CreateChoice } from "@/features/ai-workflow/components/create-choice";
import { PencilRulerIcon, SparklesIcon } from "lucide-react";

type CreateMode = "choose" | "ai";

type CreateWorkflowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateManual: () => void;
  /** Skip the choice screen and open directly in the AI prompt flow. */
  startInAiMode?: boolean;
};

export const CreateWorkflowDialog = ({
  open,
  onOpenChange,
  onCreateManual,
  startInAiMode = false,
}: CreateWorkflowDialogProps) => {
  const [mode, setMode] = useState<CreateMode>("choose");
  const [aiPhase, setAiPhase] = useState<AiPromptPhase>("prompt");
  const resolvedMode: CreateMode =
    open && startInAiMode && mode === "choose" ? "ai" : mode;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setMode("choose");
      setAiPhase("prompt");
    }
    onOpenChange(next);
  };

  const handleManual = () => {
    onCreateManual();
    handleOpenChange(false);
  };

  const isPreview = resolvedMode === "ai" && aiPhase === "preview";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto",
          isPreview ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <DialogHeader>
          <DialogTitle>
            {resolvedMode === "choose"
              ? "New workflow"
              : isPreview
                ? "Review workflow plan"
                : "Generate with AI"}
          </DialogTitle>
          <DialogDescription>
            {resolvedMode === "choose"
              ? "Choose how you'd like to create your workflow."
              : isPreview
                ? "Confirm the steps and requirements before we build your workflow."
                : "Describe what you want to automate and we'll draft a plan."}
          </DialogDescription>
        </DialogHeader>

        {resolvedMode === "choose" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <CreateChoice
              icon={<PencilRulerIcon className="size-5" />}
              title="Build Manually"
              description="Start from a blank canvas and add nodes yourself."
              onClick={handleManual}
            />
            <CreateChoice
              icon={<SparklesIcon className="size-5" />}
              title="Generate with AI"
              description="Describe your automation and let AI draft it."
              onClick={() => setMode("ai")}
            />
          </div>
        ) : (
          <AiPromptInput
            onCancel={() => handleOpenChange(false)}
            onPhaseChange={setAiPhase}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
