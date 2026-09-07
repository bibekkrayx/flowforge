import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { buildCapabilities } from "@/features/ai-workflow/capabilities/registry";
import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
} from "@/features/ai-workflow/prompts/planner-prompt";
import {
  WorkflowPlanSchema,
  type WorkflowPlan,
} from "@/features/ai-workflow/schemas/plan";
import { validatePlan } from "@/features/ai-workflow/service/validate-plan";

const PLANNER_MODEL = "gpt-4o-mini";

type PlannerDeps = {
  /** Injectable generator so tests never hit the network. */
  generate?: typeof generateObject;
  /** Override the API key (defaults to process.env.OPENAI_API_KEY). */
  apiKey?: string;
};

/**
 * Turn a natural-language prompt into a structured, validated workflow plan.
 *
 * It builds the capability snapshot, embeds it in the planner prompts, asks the
 * LLM for schema-conforming structured output, then runs the result through the
 * anti-hallucination guard before returning. Nothing is ever saved.
 */
export async function planWorkflow(
  input: { prompt: string },
  deps: PlannerDeps = {},
): Promise<WorkflowPlan> {
  const apiKey = deps.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "AI Planner: OPENAI_API_KEY is not set. Configure it before generating a workflow plan.",
    );
  }

  const generate = deps.generate ?? generateObject;

  const capabilities = buildCapabilities();
  const system = buildPlannerSystemPrompt(capabilities);
  const prompt = buildPlannerUserPrompt(input.prompt);

  const openai = createOpenAI({ apiKey });

  const { object } = await generate({
    model: openai(PLANNER_MODEL),
    schema: WorkflowPlanSchema,
    system,
    prompt,
  });

  return validatePlan(object);
}
