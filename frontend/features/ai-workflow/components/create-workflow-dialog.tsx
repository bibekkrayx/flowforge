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
import { AiPromptInput } from "@/features/ai-workflow/components/ai-prompt-input";
import { PencilRulerIcon, SparklesIcon } from "lucide-react";

type CreateMode = "choose" | "ai";

type CreateWorkflowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateManual: () => void;
};

export const CreateWorkflowDialog = ({
  open,
  onOpenChange,
  onCreateManual,
}: CreateWorkflowDialogProps) => {
  const [mode, setMode] = useState<CreateMode>("choose");

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setMode("choose");
    }
    onOpenChange(next);
  };

  const handleManual = () => {
    onCreateManual();
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "choose" ? "New workflow" : "Generate with AI"}
          </DialogTitle>
          <DialogDescription>
            {mode === "choose"
              ? "Choose how you'd like to create your workflow."
              : "Describe what you want to automate and we'll draft a plan."}
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" ? (
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
          <AiPromptInput onCancel={() => handleOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
};

type CreateChoiceProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
};

const CreateChoice = ({
  icon,
  title,
  description,
  onClick,
}: CreateChoiceProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex flex-col items-start gap-2 rounded-lg border border-border bg-muted/30 p-4 text-left transition-colors",
      "hover:border-primary/40 hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
    )}
  >
    <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
      {icon}
    </div>
    <div className="flex flex-col gap-0.5">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </button>
);
