"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface RegenerateButtonProps {
  /** The workflow currently open in the editor — used as the regenerate source. */
  workflowId: string;
}

/**
 * Entry point for re-running AI generation on the current workflow.
 *
 * Safety contract: regeneration ALWAYS produces a NEW draft workflow. The
 * workflow open in the editor is never overwritten. The confirm dialog spells
 * this out, and navigation to the AI create flow only happens after the user
 * explicitly confirms.
 */
export const RegenerateButton = ({ workflowId }: RegenerateButtonProps) => {
  const router = useRouter();

  const handleConfirm = () => {
    // Hand the source workflow id to the AI create flow, which creates a fresh
    // draft. The current workflow is left untouched.
    const params = new URLSearchParams({ regenerateFrom: workflowId });
    router.push(`/workflows/new?${params.toString()}`);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="size-4" />
          Regenerate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regenerate this workflow?</AlertDialogTitle>
          <AlertDialogDescription>
            This creates a brand-new draft workflow from the AI. Your current
            workflow stays exactly as it is — nothing here is overwritten. You
            can compare the two and keep whichever you prefer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Create new draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
