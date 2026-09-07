import { describe, expect, it } from "vitest";
import { NodeType } from "@/generated/prisma/enums";
import { deriveRequirements } from "./requirements";

describe("deriveRequirements", () => {
  it("flags an OpenAI node with empty credentialId as an unsatisfied credential", () => {
    const result = deriveRequirements([
      { id: "n1", type: NodeType.OPENAI, data: { credentialId: "" } },
    ]);

    const credentialItem = result.items.find(
      (item) => item.nodeId === "n1" && item.kind === "credential",
    );
    expect(credentialItem).toBeDefined();
    expect(credentialItem?.satisfied).toBe(false);
    expect(result.status).toBe("incomplete");
  });

  it("flags a Discord node with empty webhookUrl as unsatisfied config", () => {
    const result = deriveRequirements([
      { id: "d1", type: NodeType.DISCORD, data: { webhookUrl: "" } },
    ]);

    const configItem = result.items.find(
      (item) => item.nodeId === "d1" && item.kind === "config",
    );
    expect(configItem).toBeDefined();
    expect(configItem?.satisfied).toBe(false);
    expect(result.status).toBe("incomplete");
  });

  it("reports incomplete for a mixed graph with missing config", () => {
    const result = deriveRequirements([
      { id: "n1", type: NodeType.OPENAI, data: {} },
      { id: "d1", type: NodeType.DISCORD, data: {} },
    ]);

    expect(result.items.length).toBe(2);
    expect(result.items.every((item) => !item.satisfied)).toBe(true);
    expect(result.status).toBe("incomplete");
  });

  it("reports complete for a fully configured graph", () => {
    const result = deriveRequirements([
      { id: "n1", type: NodeType.OPENAI, data: { credentialId: "cred_1" } },
      {
        id: "d1",
        type: NodeType.DISCORD,
        data: { webhookUrl: "https://discord.com/api/webhooks/abc" },
      },
      {
        id: "e1",
        type: NodeType.EMAIL,
        data: { credentialId: "cred_2", recipient: "to@example.com" },
      },
    ]);

    expect(result.items.every((item) => item.satisfied)).toBe(true);
    expect(result.status).toBe("complete");
  });

  it("treats an empty graph as complete", () => {
    const result = deriveRequirements([]);
    expect(result.items).toEqual([]);
    expect(result.status).toBe("complete");
  });

  it("ignores node types without requirements", () => {
    const result = deriveRequirements([
      { id: "m1", type: NodeType.MANUAL_TRIGGER, data: {} },
    ]);
    expect(result.items).toEqual([]);
    expect(result.status).toBe("complete");
  });

  it("requires both a credential and config for a Google Sheets node", () => {
    const result = deriveRequirements([
      { id: "g1", type: NodeType.GOOGLE_SHEETS, data: {} },
    ]);

    const kinds = result.items.map((item) => item.kind).sort();
    expect(kinds).toEqual(["config", "credential"]);
    expect(result.status).toBe("incomplete");
  });
});
