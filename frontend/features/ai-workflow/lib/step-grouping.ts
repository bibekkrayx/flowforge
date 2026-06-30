import type { WorkflowPlan } from "@/features/ai-workflow/schemas/plan";

export type PlanStep = WorkflowPlan["steps"][number];

/**
 * High-level category a plan step belongs to, used to colour/label the
 * vertical preview list (Trigger -> AI -> Messaging -> ...).
 */
export type StepCategory =
  | "trigger"
  | "ai"
  | "messaging"
  | "logic"
  | "action";

const TRIGGER_HINTS = ["trigger", "schedule", "webhook", "event", "manual"];
const AI_HINTS = ["ai", "gpt", "claude", "llm", "model", "generate", "prompt"];
const MESSAGING_HINTS = [
  "message",
  "messaging",
  "email",
  "slack",
  "discord",
  "sms",
  "notify",
  "notification",
  "send",
];
const LOGIC_HINTS = ["loop", "for each", "branch", "if", "condition", "filter"];

/**
 * Whole-word match so short tokens (e.g. "ai") don't false-positive on
 * substrings inside other words (e.g. "em-ai-l").
 */
const matchesHint = (haystack: string, hints: string[]): boolean =>
  hints.some((hint) =>
    new RegExp(`(?:^|[^a-z])${hint}(?:$|[^a-z])`).test(haystack),
  );

/**
 * Classify a single step into a high-level category. Uses the structured
 * `nodeType` first and falls back to keyword matching on the title.
 */
export const categorizeStep = (step: PlanStep): StepCategory => {
  const haystack = `${step.nodeType} ${step.title}`.toLowerCase();

  if (matchesHint(haystack, TRIGGER_HINTS)) {
    return "trigger";
  }
  if (matchesHint(haystack, AI_HINTS)) {
    return "ai";
  }
  if (matchesHint(haystack, MESSAGING_HINTS)) {
    return "messaging";
  }
  if (matchesHint(haystack, LOGIC_HINTS)) {
    return "logic";
  }
  return "action";
};

export type CategorizedStep = PlanStep & {
  category: StepCategory;
};

/**
 * Annotate each plan step with its high-level category, preserving order.
 */
export const categorizeSteps = (steps: PlanStep[]): CategorizedStep[] =>
  steps.map((step) => ({ ...step, category: categorizeStep(step) }));

/**
 * Count of manual follow-up steps a user must still perform after the
 * workflow is generated. Prefers the explicit `manualSteps` list and
 * otherwise derives an estimate from outstanding requirements.
 */
export const estimateManualSteps = (plan: WorkflowPlan): number => {
  if (plan.manualSteps.length > 0) {
    return plan.manualSteps.length;
  }
  return plan.requiredCredentials.length + plan.requiredConfiguration.length;
};
