import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Sibling modules (Unit 1 / Unit 2) may be absent on this branch — stub them so
// the service is testable in isolation and never reaches the network.
vi.mock("@/features/ai-workflow/capabilities/registry", () => ({
  buildCapabilities: () => ({
    nodes: [],
    triggers: [{ nodeType: "manual-trigger", label: "Start" }],
    actions: [{ nodeType: "http-request", label: "HTTP Request" }],
    credentialTypes: [],
    connectionRules: [],
  }),
}));

vi.mock("@/features/ai-workflow/capabilities/node-catalog", () => ({
  SUPPORTED_NODE_TYPES: ["manual-trigger", "http-request"] as const,
}));

vi.mock("@/features/ai-workflow/schemas/plan", () => ({
  WorkflowPlanSchema: { _tag: "fake-schema" },
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => (model: string) => ({ model }),
}));

import { planWorkflow } from "@/features/ai-workflow/service/planner.service";
import type { WorkflowPlan } from "@/features/ai-workflow/schemas/plan";

const supportedPlan = {
  possible: true,
  reason: "",
  explanation: ["Start manually", "Fetch data"],
  suggestions: [],
  unsupportedFeatures: [],
  steps: [
    { nodeType: "manual-trigger", label: "Start" },
    { nodeType: "http-request", label: "Fetch" },
  ],
} as unknown as WorkflowPlan;

describe("planWorkflow", () => {
  it("returns the validated plan using an injected fake generator (no network)", async () => {
    const generate = vi.fn().mockResolvedValue({ object: supportedPlan });

    const result = await planWorkflow(
      { prompt: "fetch data from an API" },
      { generate: generate as never, apiKey: "test-key" },
    );

    expect(generate).toHaveBeenCalledOnce();
    const callArg = generate.mock.calls[0][0];
    expect(callArg.system).toContain('"manual-trigger"');
    expect(callArg.prompt).toContain("fetch data from an API");
    expect(callArg.schema).toEqual({ _tag: "fake-schema" });

    expect(result.possible).toBe(true);
    expect(result.steps).toHaveLength(2);
  });

  it("runs the result through the anti-hallucination guard", async () => {
    const hallucinated = {
      ...supportedPlan,
      steps: [
        { nodeType: "manual-trigger", label: "Start" },
        { nodeType: "gmail-trigger", label: "On email" },
      ],
    } as unknown as WorkflowPlan;
    const generate = vi.fn().mockResolvedValue({ object: hallucinated });

    const result = await planWorkflow(
      { prompt: "watch my gmail" },
      { generate: generate as never, apiKey: "test-key" },
    );

    expect(result.possible).toBe(false);
    expect(result.steps.map((s: { nodeType: string }) => s.nodeType)).toEqual([
      "manual-trigger",
    ]);
    expect(result.unsupportedFeatures).toContain("gmail-trigger");
  });

  it("throws a clear error when OPENAI_API_KEY is missing", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      await expect(
        planWorkflow(
          { prompt: "anything" },
          { generate: vi.fn() as never },
        ),
      ).rejects.toThrow(/OPENAI_API_KEY/);
    } finally {
      if (original !== undefined) {
        process.env.OPENAI_API_KEY = original;
      }
    }
  });
});
