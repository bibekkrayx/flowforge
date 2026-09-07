import { describe, expect, it } from "vitest";

import { SUPPORTED_NODE_TYPES } from "@/features/ai-workflow/capabilities/node-catalog";

import {
  PlannerInputSchema,
  WorkflowPlanSchema,
  type WorkflowPlan,
} from "./plan";

const supportedNodeType = SUPPORTED_NODE_TYPES[0];

const validPlan: WorkflowPlan = {
  possible: true,
  workflowName: "Notify on new lead",
  steps: [
    {
      title: "Trigger",
      nodeType: supportedNodeType,
      description: "Fires the workflow.",
    },
  ],
  requiredCredentials: ["slack"],
  requiredConfiguration: ["channel id"],
  unsupportedFeatures: [],
  warnings: [],
  manualSteps: [],
  explanation: [{ step: 1, title: "Start", body: "Workflow begins." }],
  reason: "",
  suggestions: [],
};

describe("WorkflowPlanSchema", () => {
  it("parses a valid plan", () => {
    expect(() => WorkflowPlanSchema.parse(validPlan)).not.toThrow();
  });

  it("rejects a plan with an unknown nodeType", () => {
    const invalid = {
      ...validPlan,
      steps: [
        {
          title: "Bad step",
          nodeType: "__not_a_real_node_type__",
          description: "Should fail.",
        },
      ],
    };

    expect(WorkflowPlanSchema.safeParse(invalid).success).toBe(false);
  });

  it("parses possible:false with reason and suggestions", () => {
    const impossible = {
      ...validPlan,
      possible: false,
      steps: [],
      explanation: [],
      reason: "No integration exists for this service.",
      suggestions: ["Try a webhook trigger instead."],
    };

    expect(() => WorkflowPlanSchema.parse(impossible)).not.toThrow();
  });
});

describe("PlannerInputSchema", () => {
  it("parses a non-empty prompt", () => {
    expect(() =>
      PlannerInputSchema.parse({ prompt: "Send a Slack message" }),
    ).not.toThrow();
  });

  it("rejects an empty prompt", () => {
    expect(PlannerInputSchema.safeParse({ prompt: "" }).success).toBe(false);
  });
});
