import z from "zod";

import { SUPPORTED_NODE_TYPES } from "@/features/ai-workflow/capabilities/node-catalog";

/**
 * A single planned step in a generated workflow.
 *
 * `nodeType` is constrained to the live node registry (SUPPORTED_NODE_TYPES)
 * so the planner can never produce an unsupported / hallucinated node type.
 * z.enum requires a non-empty string tuple, so the readonly NodeType[] is
 * cast accordingly while keeping the values sourced from the real registry.
 */
export const PlanStepSchema = z.object({
  title: z.string(),
  nodeType: z.enum(SUPPORTED_NODE_TYPES as unknown as [string, ...string[]]),
  description: z.string(),
});

export const ExplanationStepSchema = z.object({
  step: z.number(),
  title: z.string(),
  body: z.string(),
});

export const WorkflowPlanSchema = z.object({
  possible: z.boolean(),
  workflowName: z.string(),
  steps: z.array(PlanStepSchema),
  requiredCredentials: z.array(z.string()),
  requiredConfiguration: z.array(z.string()),
  unsupportedFeatures: z.array(z.string()),
  warnings: z.array(z.string()),
  manualSteps: z.array(z.string()),
  explanation: z.array(ExplanationStepSchema),
  reason: z.string(),
  suggestions: z.array(z.string()),
});

/** Input accepted by the AI planner (server router + UI). */
export const PlannerInputSchema = z.object({
  prompt: z.string().min(1, "Describe your automation"),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;
export type WorkflowPlan = z.infer<typeof WorkflowPlanSchema>;
export type PlannerInput = z.infer<typeof PlannerInputSchema>;
