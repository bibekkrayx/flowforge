import { describe, expect, it } from "vitest";
import type { WorkflowPlan } from "@/features/ai-workflow/schemas/plan";
import {
  categorizeStep,
  categorizeSteps,
  estimateManualSteps,
} from "./step-grouping";

type PlanStep = WorkflowPlan["steps"][number];

const step = (overrides: Partial<PlanStep>): PlanStep => ({
  title: "Step",
  nodeType: "action",
  description: "Does a thing",
  ...overrides,
});

const plan = (overrides: Partial<WorkflowPlan>): WorkflowPlan => ({
  possible: true,
  workflowName: "Test",
  steps: [],
  requiredCredentials: [],
  requiredConfiguration: [],
  unsupportedFeatures: [],
  warnings: [],
  manualSteps: [],
  explanation: [],
  ...overrides,
});

describe("categorizeStep", () => {
  it("classifies triggers by nodeType", () => {
    expect(categorizeStep(step({ nodeType: "schedule-trigger" }))).toBe(
      "trigger",
    );
  });

  it("classifies AI steps", () => {
    expect(
      categorizeStep(step({ nodeType: "ai-agent", title: "Summarize" })),
    ).toBe("ai");
  });

  it("classifies messaging steps", () => {
    expect(
      categorizeStep(step({ nodeType: "slack", title: "Send message" })),
    ).toBe("messaging");
  });

  it("classifies logic steps", () => {
    expect(categorizeStep(step({ nodeType: "loop", title: "For each" }))).toBe(
      "logic",
    );
  });

  it("falls back to action", () => {
    expect(
      categorizeStep(step({ nodeType: "http-request", title: "Call API" })),
    ).toBe("action");
  });

  it("uses the title as a fallback hint", () => {
    expect(
      categorizeStep(step({ nodeType: "node", title: "Send email digest" })),
    ).toBe("messaging");
  });
});

describe("categorizeSteps", () => {
  it("preserves order and annotates each step", () => {
    const result = categorizeSteps([
      step({ nodeType: "manual-trigger", title: "Start" }),
      step({ nodeType: "ai-agent", title: "Draft" }),
    ]);

    expect(result.map((s) => s.category)).toEqual(["trigger", "ai"]);
    expect(result[0].title).toBe("Start");
  });
});

describe("estimateManualSteps", () => {
  it("prefers explicit manual steps", () => {
    expect(
      estimateManualSteps(
        plan({ manualSteps: ["Connect Slack", "Set channel"] }),
      ),
    ).toBe(2);
  });

  it("derives from requirements when no manual steps", () => {
    expect(
      estimateManualSteps(
        plan({
          requiredCredentials: ["slack"],
          requiredConfiguration: ["channel", "schedule"],
        }),
      ),
    ).toBe(3);
  });

  it("returns zero when nothing is outstanding", () => {
    expect(estimateManualSteps(plan({}))).toBe(0);
  });
});
