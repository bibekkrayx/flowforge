"use client";

import {
  EntityContainer,
  EntityHeader,
  EntityList,
  EntityItem,
  EntityPagination,
  EntitySearch,
  EmptyView,
  LoadingView,
  ErrorView,
} from "@/components/entity-components";
import { useWorkflowParams } from "@/features/workflows/hooks/use-workflow-params";
import {
  useCreateWorkflow,
  useRemoveWorkflow,
  useSuspenseWorkflows,
} from "@/features/workflows/hooks/use-workflows";
import { WorkflowIcon } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { CreateWorkflowDialog } from "@/features/ai-workflow/components/create-workflow-dialog";

export const WorkflowContainer = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [params, setParams] = useWorkflowParams();
  const createWorkflow = useCreateWorkflow();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <EntityContainer
      header={
        <>
          <EntityHeader
            title="Workflows"
            description="Manage your automation workflows"
            onNew={() => setIsCreateDialogOpen(true)}
            newButtonLabel="New workflow"
            isCreating={createWorkflow.isPending}
          />
          <CreateWorkflowDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onCreateManual={() => createWorkflow.mutate()}
          />
        </>
      }
      search={
        <EntitySearch
          value={params.search}
          onChange={(search) => setParams({ search, page: 1 })}
          placeholder="Search workflows..."
        />
      }
    >
      {children}
    </EntityContainer>
  );
};

export const WorkflowList = () => {
  const { data } = useSuspenseWorkflows();
  const [, setParams] = useWorkflowParams();
  const removeWorkflow = useRemoveWorkflow();

  return (
    <>
      <EntityList
        items={data.items}
        getKey={(item) => item.id}
        emptyView={
          <EmptyView message="Get started by creating a new workflow." />
        }
        renderItem={(item) => (
          <EntityItem
            href={`/workflows/${item.id}`}
            title={item.name}
            subtitle={format(new Date(item.updatedAt), "M/d/yyyy")}
            image={
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <WorkflowIcon className="size-5 text-primary" />
              </div>
            }
            onRemove={() => removeWorkflow.mutate({ id: item.id })}
            isRemoving={removeWorkflow.isPending}
          />
        )}
      />
      {data.totalPages > 0 && (
        <EntityPagination
          page={data.page}
          totalPages={data.totalPages}
          onPageChange={(page) => setParams({ page })}
          disabled={removeWorkflow.isPending}
        />
      )}
    </>
  );
};

export const WorkflowLoading = () => {
  return <LoadingView message="Loading workflows..." />;
};

export const WorkflowError = () => {
  return <ErrorView message="Failed to load workflows." />;
};
