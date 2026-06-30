import { createTRPCRouter } from "../init";
import { adminRouter } from "@/features/admin/server/routers";
import { workflowsRouter } from "@/features/workflows/server/routers";
import { credentialsRouter } from "@/features/credentials/server/routers";
import { executionsRouter } from "@/features/execution/server/routers";
import { calendarRouter } from "@/features/calendar/server/routers";
import { aiWorkflowRouter } from "@/features/ai-workflow/server/routers";

export const appRouter = createTRPCRouter({
  admin: adminRouter,
  workflows: workflowsRouter,
  credentials: credentialsRouter,
  executions: executionsRouter,
  calendar: calendarRouter,
  aiWorkflow: aiWorkflowRouter,
});

export type AppRouter = typeof appRouter;
