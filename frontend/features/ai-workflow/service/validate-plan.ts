import { SUPPORTED_NODE_TYPES } from "@/features/ai-workflow/capabilities/node-catalog";
import type { WorkflowPlan } from "@/features/ai-workflow/schemas/plan";

/**
 * Anti-hallucination guard for AI-generated workflow plans.
 *
 * The LLM is instructed to only emit supported `nodeType` identifiers, but we
 * never trust it. This pure function drops any step whose `nodeType` is not in
 * the supported set, records the offending types in `unsupportedFeatures`, and
 * marks the plan as `possible: false` with a human-readable `reason` and
 * `suggestions` so the UI can explain what happened.
 *
 * It also normalizes the plan so the array fields the rest of the app relies on
 * (`steps`, `explanation`, `suggestions`, `unsupportedFeatures`) are always
 * present.
 */
export function validatePlan(
  plan: WorkflowPlan,
  supported: readonly string[] = SUPPORTED_NODE_TYPES,
): WorkflowPlan {
  const supportedSet = new Set(supported);

  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const explanation = Array.isArray(plan.explanation) ? plan.explanation : [];
  const suggestions = Array.isArray(plan.suggestions) ? plan.suggestions : [];
  const unsupportedFeatures = Array.isArray(plan.unsupportedFeatures)
    ? plan.unsupportedFeatures
    : [];

  const supportedSteps: typeof steps = [];
  const droppedNodeTypes: string[] = [];

  for (const step of steps) {
    if (supportedSet.has(step.nodeType)) {
      supportedSteps.push(step);
    } else {
      droppedNodeTypes.push(step.nodeType);
    }
  }

  const validated: WorkflowPlan = {
    ...plan,
    steps: supportedSteps,
    explanation,
    suggestions,
    unsupportedFeatures,
  };

  if (droppedNodeTypes.length === 0) {
    return validated;
  }

  const uniqueDropped = Array.from(new Set(droppedNodeTypes));

  validated.possible = false;
  validated.unsupportedFeatures = Array.from(
    new Set([...unsupportedFeatures, ...uniqueDropped]),
  );

  const droppedList = uniqueDropped.join(", ");
  const droppedReason = `The plan referenced unsupported node type(s): ${droppedList}. They were removed because they are not part of FlowForge's available capabilities.`;
  validated.reason = plan.reason ? `${plan.reason} ${droppedReason}` : droppedReason;

  if (validated.suggestions.length === 0) {
    validated.suggestions = [
      "Use an HTTP Request node to integrate with the unsupported service via its API.",
      "Build a new custom node for the unsupported capability, then re-run the planner.",
    ];
  }

  return validated;
}
