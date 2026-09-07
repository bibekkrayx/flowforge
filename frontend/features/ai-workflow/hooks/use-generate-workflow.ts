"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Wraps the `aiWorkflow.generate` mutation. On success it saves the workflow
 * via the existing API, refreshes the list, and redirects to the editor.
 */
export const useGenerateWorkflow = () => {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.aiWorkflow.generate.mutationOptions({
      onSuccess: ({ workflowId }) => {
        toast.success("Workflow generated.");
        queryClient.invalidateQueries(
          trpc.workflows.getMany.queryOptions({}),
        );
        router.push(`/workflows/${workflowId}`);
      },
      onError: (error) => {
        toast.error(`Failed to generate workflow: ${error.message}`);
      },
    }),
  );
};
