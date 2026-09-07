import { describe, expect, it, vi } from "vitest";

// Unit 1's registry is a type-only dependency here; stub it so the test runs
// without the sibling module present on this branch.
vi.mock("@/features/ai-workflow/capabilities/registry", () => ({
  buildCapabilities: () => ({}),
}));

import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  type CapabilitySnapshot,
} from "@/features/ai-workflow/prompts/planner-prompt";

const snapshot = {
  nodes: [],
  triggers: [
    {
      nodeType: "manual-trigger",
      label: "Manual Trigger",
      description: "Start the workflow on demand.",
    },
    {
      nodeType: "webhook-trigger",
      label: "Webhook",
      description: "Start when an HTTP request is received.",
    },
  ],
  actions: [
    {
      nodeType: "http-request",
      label: "HTTP Request",
      description: "Call an external API.",
    },
    {
      nodeType: "openai",
      label: "OpenAI",
      description: "Generate text with an LLM.",
    },
  ],
  credentialTypes: [
    { type: "openai", description: "OpenAI API key" },
  ],
  connectionRules: [
    { from: "manual-trigger", to: "http-request" },
  ],
} as unknown as CapabilitySnapshot;

describe("buildPlannerSystemPrompt", () => {
  it("embeds every supported node type identifier", () => {
    const prompt = buildPlannerSystemPrompt(snapshot);

    expect(prompt).toContain('"manual-trigger"');
    expect(prompt).toContain('"webhook-trigger"');
    expect(prompt).toContain('"http-request"');
    expect(prompt).toContain('"openai"');
  });

  it("includes node descriptions and credential types", () => {
    const prompt = buildPlannerSystemPrompt(snapshot);

    expect(prompt).toContain("Call an external API.");
    expect(prompt).toContain("OpenAI API key");
  });

  it("includes connection rules", () => {
    const prompt = buildPlannerSystemPrompt(snapshot);

    expect(prompt).toContain('"manual-trigger" -> "http-request"');
  });

  it("states the anti-hallucination instruction", () => {
    const prompt = buildPlannerSystemPrompt(snapshot);

    expect(prompt.toLowerCase()).toContain("never invent");
    expect(prompt).toContain('"possible"');
    expect(prompt.toLowerCase()).toContain("unsupported");
  });

  it("instructs the model to leave external config to the user", () => {
    const prompt = buildPlannerSystemPrompt(snapshot);

    expect(prompt.toLowerCase()).toContain("webhook");
    expect(prompt.toLowerCase()).toContain("credential");
  });

  it("degrades gracefully when no nodes are available", () => {
    const empty = {
      nodes: [],
      triggers: [],
      actions: [],
      credentialTypes: [],
      connectionRules: [],
    } as unknown as CapabilitySnapshot;

    const prompt = buildPlannerSystemPrompt(empty);

    expect(prompt).toContain("(none available)");
  });
});

describe("buildPlannerUserPrompt", () => {
  it("wraps and trims the raw request", () => {
    const prompt = buildPlannerUserPrompt("  send a daily report  ");

    expect(prompt).toContain("send a daily report");
    expect(prompt).toContain("Request:");
  });
});
