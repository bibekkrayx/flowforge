"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Wraps the `aiWorkflow.plan` mutation. Phase 1 only: produces a
 * `WorkflowPlan` preview from a natural-language prompt without saving.
 */
export const useAiPlanner = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.aiWorkflow.plan.mutationOptions({
      onError: (error) => {
        toast.error(`Failed to analyze prompt: ${error.message}`);
      },
    }),
  );
};
