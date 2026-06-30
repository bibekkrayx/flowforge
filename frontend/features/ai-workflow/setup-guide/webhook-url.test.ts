import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildWebhookUrl, resolveAppUrl } from "./webhook-url";

describe("resolveAppUrl", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = original;
    }
  });

  it("falls back to localhost when env is unset", () => {
    expect(resolveAppUrl()).toBe("http://localhost:3000");
  });

  it("uses NEXT_PUBLIC_APP_URL when set", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.flowforge.dev";
    expect(resolveAppUrl()).toBe("https://app.flowforge.dev");
  });

  it("trims a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.flowforge.dev/";
    expect(resolveAppUrl()).toBe("https://app.flowforge.dev");
  });
});

describe("buildWebhookUrl", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.flowforge.dev";
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = original;
    }
  });

  it("builds a google-form webhook URL", () => {
    expect(buildWebhookUrl("google-form", "wf_123")).toBe(
      "https://app.flowforge.dev/api/webhooks/google-form?workflowId=wf_123",
    );
  });

  it("builds a stripe webhook URL", () => {
    expect(buildWebhookUrl("stripe", "wf_123")).toBe(
      "https://app.flowforge.dev/api/webhooks/stripe?workflowId=wf_123",
    );
  });

  it("encodes special characters in the workflow id", () => {
    expect(buildWebhookUrl("stripe", "a b&c")).toBe(
      "https://app.flowforge.dev/api/webhooks/stripe?workflowId=a%20b%26c",
    );
  });

  it("trims surrounding whitespace from the id", () => {
    expect(buildWebhookUrl("stripe", "  wf_123  ")).toBe(
      "https://app.flowforge.dev/api/webhooks/stripe?workflowId=wf_123",
    );
  });

  it("throws when the workflow id is blank", () => {
    expect(() => buildWebhookUrl("stripe", "   ")).toThrow(/workflowId/);
  });
});
