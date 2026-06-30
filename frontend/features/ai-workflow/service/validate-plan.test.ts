import { describe, expect, it, vi } from "vitest";

// Unit 1's node-catalog is a sibling module that may not exist on this branch.
// Mock it so this unit's tests are self-contained and never hit the network.
vi.mock("@/features/ai-workflow/capabilities/node-catalog", () => ({
  SUPPORTED_NODE_TYPES: [
    "manual-trigger",
    "http-request",
    "openai",
    "filter",
  ] as const,
}));

// Unit 2's schema module is type-only at runtime for these tests.
vi.mock("@/features/ai-workflow/schemas/plan", () => ({}));

import { validatePlan } from "@/features/ai-workflow/service/validate-plan";
import type { WorkflowPlan } from "@/features/ai-workflow/schemas/plan";

function makePlan(overrides: Partial<WorkflowPlan> = {}): WorkflowPlan {
  return {
    possible: true,
    reason: "",
    explanation: ["Start manually", "Call the API"],
    suggestions: [],
    unsupportedFeatures: [],
    steps: [
      { nodeType: "manual-trigger", label: "Start" },
      { nodeType: "http-request", label: "Fetch data" },
    ],
    ...overrides,
  } as unknown as WorkflowPlan;
}

describe("validatePlan", () => {
  it("passes a fully-supported plan through unchanged", () => {
    const plan = makePlan();

    const result = validatePlan(plan);

    expect(result.possible).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.unsupportedFeatures).toEqual([]);
    expect(result.reason).toBe("");
  });

  it("strips an unknown nodeType and sets possible:false with a reason", () => {
    const plan = makePlan({
      steps: [
        { nodeType: "manual-trigger", label: "Start" },
        { nodeType: "gmail-trigger", label: "On new email" },
        { nodeType: "http-request", label: "Fetch data" },
      ],
    } as unknown as Partial<WorkflowPlan>);

    const result = validatePlan(plan);

    expect(result.possible).toBe(false);
    expect(result.steps.map((s: { nodeType: string }) => s.nodeType)).toEqual([
      "manual-trigger",
      "http-request",
    ]);
    expect(result.unsupportedFeatures).toContain("gmail-trigger");
    expect(result.reason).toContain("gmail-trigger");
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("respects an explicit supported list argument", () => {
    const plan = makePlan({
      steps: [{ nodeType: "http-request", label: "Fetch" }],
    } as unknown as Partial<WorkflowPlan>);

    const result = validatePlan(plan, ["manual-trigger"]);

    expect(result.possible).toBe(false);
    expect(result.steps).toHaveLength(0);
    expect(result.unsupportedFeatures).toContain("http-request");
  });

  it("defaults missing array fields to empty arrays", () => {
    const plan = {
      possible: true,
      steps: [{ nodeType: "manual-trigger" }],
    } as unknown as WorkflowPlan;

    const result = validatePlan(plan);

    expect(result.explanation).toEqual([]);
    expect(result.suggestions).toEqual([]);
    expect(result.unsupportedFeatures).toEqual([]);
    expect(result.steps).toHaveLength(1);
  });

  it("de-duplicates repeated unsupported node types", () => {
    const plan = makePlan({
      steps: [
        { nodeType: "slack", label: "a" },
        { nodeType: "slack", label: "b" },
      ],
    } as unknown as Partial<WorkflowPlan>);

    const result = validatePlan(plan);

    expect(
      result.unsupportedFeatures.filter((f: string) => f === "slack"),
    ).toHaveLength(1);
  });
});
