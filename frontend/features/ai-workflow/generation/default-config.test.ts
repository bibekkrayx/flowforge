import { describe, expect, it } from "vitest";

import { NodeType } from "@/generated/prisma/enums";

import { defaultDataForNode } from "@/features/ai-workflow/generation/default-config";

const VARIABLE_NAME_REGEX = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

describe("defaultDataForNode", () => {
  it("produces unique, regex-valid variable names across a multi-node list", () => {
    const types: NodeType[] = [
      NodeType.OPENAI,
      NodeType.ANTHROPIC,
      NodeType.GEMINI,
      NodeType.DISCORD,
      NodeType.SLACK,
      NodeType.HTTP_REQUEST,
      NodeType.LOOP,
    ];

    const names = types.map(
      (type, index) =>
        defaultDataForNode(type, { index }).variableName as string,
    );

    for (const name of names) {
      expect(name).toMatch(VARIABLE_NAME_REGEX);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps variable names unique even for repeated node types", () => {
    const a = defaultDataForNode(NodeType.OPENAI, { index: 0 })
      .variableName as string;
    const b = defaultDataForNode(NodeType.OPENAI, { index: 1 })
      .variableName as string;
    expect(a).not.toBe(b);
    expect(a).toMatch(VARIABLE_NAME_REGEX);
    expect(b).toMatch(VARIABLE_NAME_REGEX);
  });

  it("gives AI nodes the helpful-assistant system prompt and an upstream-referencing user prompt", () => {
    const data = defaultDataForNode(NodeType.OPENAI, {
      index: 1,
      upstreamVarName: "form_data",
    });
    expect(data.systemPrompt).toBe("You are a helpful assistant.");
    expect(data.userPrompt).toBe(
      "Summarize the following data:\n{{json form_data}}",
    );
    expect(data.credentialId).toBe("");
  });

  it("falls back to a generic AI user prompt without an upstream variable", () => {
    const data = defaultDataForNode(NodeType.ANTHROPIC, { index: 0 });
    expect(data.systemPrompt).toBe("You are a helpful assistant.");
    expect(typeof data.userPrompt).toBe("string");
    expect(data.userPrompt as string).not.toContain("{{json");
  });

  it("leaves Discord webhookUrl empty and sets aiSourceVariable from upstream", () => {
    const data = defaultDataForNode(NodeType.DISCORD, {
      index: 0,
      upstreamVarName: "openai_1",
    });
    expect(data.webhookUrl).toBe("");
    expect(data.aiSourceVariable).toBe("openai_1");
  });

  it("defaults Discord aiSourceVariable to empty when no upstream variable", () => {
    const data = defaultDataForNode(NodeType.DISCORD, { index: 0 });
    expect(data.aiSourceVariable).toBe("");
  });

  it("references the upstream variable in Slack content when available", () => {
    const data = defaultDataForNode(NodeType.SLACK, {
      index: 2,
      upstreamVarName: "openai_1",
    });
    expect(data.webhookUrl).toBe("");
    expect(data.content).toBe("{{openai_1.text}}");
  });

  it("gives HTTP_REQUEST an empty endpoint and GET method", () => {
    const data = defaultDataForNode(NodeType.HTTP_REQUEST, { index: 0 });
    expect(data.endpoint).toBe("");
    expect(data.method).toBe("GET");
  });

  it("returns minimal data for triggers and unknown types", () => {
    expect(defaultDataForNode(NodeType.MANUAL_TRIGGER, { index: 0 })).toEqual(
      {},
    );
    expect(
      defaultDataForNode(NodeType.GOOGLE_FORM_TRIGGER, { index: 0 }),
    ).toEqual({});
    expect(defaultDataForNode(NodeType.SCHEDULE_TRIGGER, { index: 0 })).toEqual(
      {},
    );
  });
});
