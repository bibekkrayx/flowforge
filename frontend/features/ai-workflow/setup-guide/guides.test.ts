import { describe, expect, it } from "vitest";
import { NodeType } from "@/generated/prisma/enums";
import {
  getSetupGuideForNode,
  SETUP_GUIDES,
  WEBHOOK_URL_PLACEHOLDER,
} from "./guides";

describe("setup guides", () => {
  it("provides a guide for every external integration", () => {
    const integrations = [
      "google-form",
      "discord",
      "stripe",
      "slack",
      "google-sheets",
      "email",
      "schedule",
    ];

    for (const key of integrations) {
      const guide = SETUP_GUIDES[key];
      expect(guide, `missing guide for ${key}`).toBeDefined();
      expect(guide.integration.length).toBeGreaterThan(0);
      expect(guide.estimatedMinutes).toBeGreaterThan(0);
      expect(guide.steps.length).toBeGreaterThanOrEqual(1);
      for (const step of guide.steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses the webhook placeholder in copyable webhook steps", () => {
    const copyableSteps = SETUP_GUIDES["discord"].steps.concat(
      SETUP_GUIDES["google-form"].steps,
      SETUP_GUIDES["stripe"].steps,
    );

    const placeholderSteps = copyableSteps.filter((step) =>
      step.detail.includes(WEBHOOK_URL_PLACEHOLDER),
    );
    for (const step of placeholderSteps) {
      expect(step.copyable).toBe(true);
    }
    // Google Form and Stripe expose a copyable webhook step.
    expect(
      SETUP_GUIDES["google-form"].steps.some((s) => s.copyable),
    ).toBe(true);
    expect(SETUP_GUIDES["stripe"].steps.some((s) => s.copyable)).toBe(true);
  });

  it("returns the Discord guide for a Discord node", () => {
    const guide = getSetupGuideForNode(NodeType.DISCORD);
    expect(guide).toBe(SETUP_GUIDES["discord"]);
    expect(guide?.integration).toBe("Discord");
  });

  it("returns the matching guide for each mapped node type", () => {
    expect(getSetupGuideForNode(NodeType.GOOGLE_FORM_TRIGGER)).toBe(
      SETUP_GUIDES["google-form"],
    );
    expect(getSetupGuideForNode(NodeType.STRIPE_TRIGGER)).toBe(
      SETUP_GUIDES["stripe"],
    );
    expect(getSetupGuideForNode(NodeType.SLACK)).toBe(SETUP_GUIDES["slack"]);
    expect(getSetupGuideForNode(NodeType.EMAIL)).toBe(SETUP_GUIDES["email"]);
    expect(getSetupGuideForNode(NodeType.GOOGLE_SHEETS)).toBe(
      SETUP_GUIDES["google-sheets"],
    );
    expect(getSetupGuideForNode(NodeType.SCHEDULE_TRIGGER)).toBe(
      SETUP_GUIDES["schedule"],
    );
  });

  it("returns undefined for node types without an external setup guide", () => {
    expect(getSetupGuideForNode(NodeType.MANUAL_TRIGGER)).toBeUndefined();
    expect(getSetupGuideForNode(NodeType.LOOP)).toBeUndefined();
  });
});
