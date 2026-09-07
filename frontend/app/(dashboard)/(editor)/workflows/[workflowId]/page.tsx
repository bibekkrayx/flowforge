import {
  Editor,
  EditorError,
  EditorLoading,
} from "@/features/editor/components/editor";
import { EditorHeader } from "@/features/editor/components/editor-header";
import { SetupOverlay } from "@/features/ai-workflow/components/setup-overlay";
import { prefetchWorkflow } from "@/features/workflows/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface PageProp {
  params: Promise<{
    workflowId: string;
  }>;
}

const Page = async ({ params }: PageProp) => {
  await requireAuth();

  const { workflowId } = await params;
  prefetchWorkflow(workflowId);

  return (
    <HydrateClient>
      <ErrorBoundary fallback={<EditorError />}>
        <Suspense fallback={<EditorLoading />}>
          <div className="flex h-svh min-h-0 flex-col">
            <EditorHeader workflowId={workflowId} />
            <main className="relative min-h-0 flex-1">
              <Editor workflowId={workflowId} />
              <SetupOverlay workflowId={workflowId} />
            </main>
          </div>
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  );
};

export default Page;
