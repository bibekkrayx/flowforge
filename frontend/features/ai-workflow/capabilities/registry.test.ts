import { describe, expect, it } from "vitest";
import { CredentialType, NodeType } from "@/generated/prisma/enums";
import { buildCapabilities } from "@/features/ai-workflow/capabilities/registry";
import { NODE_CATALOG } from "@/features/ai-workflow/capabilities/node-catalog";

describe("buildCapabilities", () => {
  it("returns the full catalog as nodes", () => {
    const snapshot = buildCapabilities();
    expect(snapshot.nodes).toHaveLength(NODE_CATALOG.length);
    expect(snapshot.nodes.map((n) => n.type)).toEqual(
      NODE_CATALOG.map((n) => n.type),
    );
  });

  it("partitions triggers vs actions exhaustively", () => {
    const snapshot = buildCapabilities();
    expect(snapshot.triggers.every((n) => n.kind === "trigger")).toBe(true);
    expect(snapshot.actions.every((n) => n.kind === "action")).toBe(true);
    expect(snapshot.triggers.length + snapshot.actions.length).toBe(
      snapshot.nodes.length,
    );

    const triggerTypes = snapshot.triggers.map((n) => n.type);
    expect(triggerTypes).toContain(NodeType.MANUAL_TRIGGER);
    expect(triggerTypes).toContain(NodeType.EVENT_TRIGGER);
    expect(triggerTypes).not.toContain(NodeType.OPENAI);
  });

  it("never includes the INITIAL placeholder", () => {
    const snapshot = buildCapabilities();
    expect(snapshot.nodes.map((n) => n.type)).not.toContain(NodeType.INITIAL);
  });

  it("lists all supported credential types", () => {
    const snapshot = buildCapabilities();
    expect([...snapshot.credentialTypes].sort()).toEqual(
      [...Object.values(CredentialType)].sort(),
    );
  });

  it("provides non-empty connection rules", () => {
    const snapshot = buildCapabilities();
    expect(snapshot.connectionRules.length).toBeGreaterThan(0);
    expect(snapshot.connectionRules.every((rule) => rule.length > 0)).toBe(true);
  });

  it("returns a JSON-serializable snapshot", () => {
    const snapshot = buildCapabilities();
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });
});
