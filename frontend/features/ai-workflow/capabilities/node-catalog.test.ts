import { describe, expect, it } from "vitest";
import { REGISTERED_NODE_TYPES } from "@/config/node-type-metadata";
import { CredentialType, NodeType } from "@/generated/prisma/enums";
import {
  NODE_CATALOG,
  SUPPORTED_NODE_TYPES,
  getNodeCapability,
} from "@/features/ai-workflow/capabilities/node-catalog";

const REGISTRY_TYPES = [...REGISTERED_NODE_TYPES];

describe("NODE_CATALOG", () => {
  it("has an entry for every supported registry node type", () => {
    for (const type of REGISTRY_TYPES) {
      expect(getNodeCapability(type)).toBeDefined();
    }
    expect(NODE_CATALOG).toHaveLength(REGISTRY_TYPES.length);
  });

  it("excludes the internal INITIAL placeholder", () => {
    expect(SUPPORTED_NODE_TYPES).not.toContain(NodeType.INITIAL);
    expect(getNodeCapability(NodeType.INITIAL)).toBeUndefined();
  });

  it("classifies trigger nodes correctly", () => {
    const triggers = [
      NodeType.MANUAL_TRIGGER,
      NodeType.GOOGLE_FORM_TRIGGER,
      NodeType.STRIPE_TRIGGER,
      NodeType.SCHEDULE_TRIGGER,
      NodeType.EVENT_TRIGGER,
    ];
    for (const type of triggers) {
      expect(getNodeCapability(type)?.kind).toBe("trigger");
    }
  });

  it("classifies non-trigger nodes as actions", () => {
    const actions = [
      NodeType.HTTP_REQUEST,
      NodeType.OPENAI,
      NodeType.ANTHROPIC,
      NodeType.GEMINI,
      NodeType.DISCORD,
      NodeType.SLACK,
      NodeType.EMAIL,
      NodeType.GOOGLE_SHEETS,
      NodeType.LOOP,
    ];
    for (const type of actions) {
      expect(getNodeCapability(type)?.kind).toBe("action");
    }
  });

  it("maps credential types correctly", () => {
    expect(getNodeCapability(NodeType.OPENAI)?.credentialType).toBe(
      CredentialType.OPENAI,
    );
    expect(getNodeCapability(NodeType.ANTHROPIC)?.credentialType).toBe(
      CredentialType.ANTHROPIC,
    );
    expect(getNodeCapability(NodeType.GEMINI)?.credentialType).toBe(
      CredentialType.GEMINI,
    );
    expect(getNodeCapability(NodeType.DISCORD)?.credentialType).toBeUndefined();
    expect(getNodeCapability(NodeType.SLACK)?.credentialType).toBeUndefined();
    expect(getNodeCapability(NodeType.EMAIL)?.credentialType).toBe(
      CredentialType.RESEND,
    );
    expect(getNodeCapability(NodeType.GOOGLE_SHEETS)?.credentialType).toBe(
      CredentialType.GOOGLE_SHEETS,
    );
  });

  it("has no credential for triggers, webhook messaging, HTTP_REQUEST, and LOOP", () => {
    const credentialless = [
      NodeType.MANUAL_TRIGGER,
      NodeType.GOOGLE_FORM_TRIGGER,
      NodeType.STRIPE_TRIGGER,
      NodeType.SCHEDULE_TRIGGER,
      NodeType.EVENT_TRIGGER,
      NodeType.DISCORD,
      NodeType.SLACK,
      NodeType.HTTP_REQUEST,
      NodeType.LOOP,
    ];
    for (const type of credentialless) {
      expect(getNodeCapability(type)?.credentialType).toBeUndefined();
    }
  });

  it("lists required config fields, with none for AI nodes and MANUAL_TRIGGER", () => {
    expect(getNodeCapability(NodeType.GOOGLE_FORM_TRIGGER)?.requiredConfig).toEqual(
      ["Google Form ID"],
    );
    expect(getNodeCapability(NodeType.DISCORD)?.requiredConfig).toEqual([
      "Discord Webhook URL",
    ]);
    expect(getNodeCapability(NodeType.HTTP_REQUEST)?.requiredConfig).toEqual([
      "Endpoint URL",
    ]);

    expect(getNodeCapability(NodeType.MANUAL_TRIGGER)?.requiredConfig).toEqual(
      [],
    );
    expect(getNodeCapability(NodeType.OPENAI)?.requiredConfig).toEqual([]);
    expect(getNodeCapability(NodeType.ANTHROPIC)?.requiredConfig).toEqual([]);
    expect(getNodeCapability(NodeType.GEMINI)?.requiredConfig).toEqual([]);
  });

  it("populates label and description from node type metadata", () => {
    for (const entry of NODE_CATALOG) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});
