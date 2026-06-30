import { describe, expect, it } from "vitest";
import { NodeType } from "@/generated/prisma/enums";
import type { WorkflowPlan } from "@/features/ai-workflow/schemas/plan";
import { planToGraph } from "./plan-to-graph";

/** Deterministic id factory: id0, id1, id2, ... so structure is assertable. */
function stubIdFactory() {
  let n = 0;
  return () => `id${n++}`;
}

function makePlan(steps: WorkflowPlan["steps"]): WorkflowPlan {
  return {
    possible: true,
    workflowName: "Test Workflow",
    steps,
    requiredCredentials: [],
    requiredConfiguration: [],
  } as unknown as WorkflowPlan;
}

describe("planToGraph", () => {
  it("maps a 3-step plan to 3 nodes and 2 chained edges", () => {
    const plan = makePlan([
      {
        title: "On form submit",
        nodeType: NodeType.GOOGLE_FORM_TRIGGER,
        description: "Trigger when a Google Form is submitted",
      },
      {
        title: "Summarize",
        nodeType: NodeType.OPENAI,
        description: "Summarize the submission with OpenAI",
      },
      {
        title: "Post to Discord",
        nodeType: NodeType.DISCORD,
        description: "Send the summary to Discord",
      },
    ]);

    const { nodes, edges } = planToGraph(plan, {
      idFactory: stubIdFactory(),
    });

    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);

    // Node ids are minted before edge ids by the stub factory.
    expect(nodes.map((node) => node.id)).toEqual(["id0", "id1", "id2"]);

    expect(nodes.map((node) => node.type)).toEqual([
      NodeType.GOOGLE_FORM_TRIGGER,
      NodeType.OPENAI,
      NodeType.DISCORD,
    ]);

    // Sequential wiring: step[0] -> step[1] -> step[2].
    expect(edges).toEqual([
      { id: "id3", source: "id0", target: "id1" },
      { id: "id4", source: "id1", target: "id2" },
    ]);
  });

  it("lays nodes out in a non-overlapping vertical column", () => {
    const plan = makePlan([
      {
        title: "On form submit",
        nodeType: NodeType.GOOGLE_FORM_TRIGGER,
        description: "trigger",
      },
      { title: "Summarize", nodeType: NodeType.OPENAI, description: "ai" },
      { title: "Post", nodeType: NodeType.DISCORD, description: "send" },
    ]);

    const { nodes } = planToGraph(plan, { idFactory: stubIdFactory() });

    const ys = nodes.map((node) => node.position.y);
    const sorted = [...ys].sort((a, b) => a - b);
    expect(ys).toEqual(sorted);
    // strictly increasing -> no two nodes share a y position.
    expect(new Set(ys).size).toBe(ys.length);
  });

  it("wires upstream variable names through AI and messaging nodes", () => {
    const plan = makePlan([
      {
        title: "On form submit",
        nodeType: NodeType.GOOGLE_FORM_TRIGGER,
        description: "trigger",
      },
      { title: "Summarize", nodeType: NodeType.OPENAI, description: "ai" },
      { title: "Post", nodeType: NodeType.DISCORD, description: "send" },
    ]);

    const { nodes } = planToGraph(plan, { idFactory: stubIdFactory() });

    const [trigger, openai, discord] = nodes;

    const triggerVar = trigger.data.variableName as string;
    const openaiVar = openai.data.variableName as string;

    // OpenAI references the trigger's upstream output variable.
    expect(String(openai.data.userPrompt)).toContain(triggerVar);
    // Discord pulls from the OpenAI node's output variable.
    expect(discord.data.aiSourceVariable).toBe(openaiVar);
  });

  it("returns no nodes or edges for an empty plan", () => {
    const plan = makePlan([]);
    const { nodes, edges } = planToGraph(plan, {
      idFactory: stubIdFactory(),
    });
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });
});
