"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAiPlanner } from "@/features/ai-workflow/hooks/use-ai-planner";
import { WorkflowPreview } from "@/features/ai-workflow/components/workflow-preview";
import { SparklesIcon } from "lucide-react";

type AiPromptInputProps = {
  onCancel: () => void;
};

export const AiPromptInput = ({ onCancel }: AiPromptInputProps) => {
  const [prompt, setPrompt] = useState("");
  const planner = useAiPlanner();
  const plan = planner.data;

  if (plan) {
    return <WorkflowPreview plan={plan} onCancel={onCancel} />;
  }

  const trimmedPrompt = prompt.trim();

  const handleAnalyze = () => {
    if (!trimmedPrompt || planner.isPending) {
      return;
    }
    planner.mutate({ prompt: trimmedPrompt });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="ai-workflow-prompt" className="text-sm font-medium">
          Describe your automation
        </label>
        <Textarea
          id="ai-workflow-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="e.g. When a new event is added to my calendar, summarize it with AI and send me a Slack message."
          rows={5}
          disabled={planner.isPending}
        />
        <p className="text-xs text-muted-foreground">
          We&apos;ll analyze your description and propose a workflow plan.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={planner.isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={handleAnalyze}
          disabled={!trimmedPrompt || planner.isPending}
        >
          {planner.isPending ? <Spinner /> : <SparklesIcon className="size-4" />}
          {planner.isPending ? "Analyzing..." : "Generate"}
        </Button>
      </div>
    </div>
  );
};
