/**
 * Pure helpers for building the inbound webhook URL that users paste into an
 * external provider (Google Form, Stripe) so it can trigger a FlowForge
 * workflow.
 *
 * The URL shape is:
 *   `${NEXT_PUBLIC_APP_URL}/api/webhooks/<receiver>?workflowId=<id>`
 *
 * Kept free of React / DOM so it can be unit-tested in the node vitest env.
 */

/** Providers that expose an inbound webhook receiver. */
export type WebhookProvider = "google-form" | "stripe";

const DEFAULT_APP_URL = "http://localhost:3000";

/** Maps a provider key to its API receiver path segment. */
const RECEIVER_PATH: Record<WebhookProvider, string> = {
  "google-form": "google-form",
  stripe: "stripe",
};

/** Resolves the public app origin, trimming any trailing slash. */
export function resolveAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL;
  return raw.replace(/\/+$/, "");
}

/**
 * Builds the inbound webhook URL for a provider + workflow.
 *
 * @throws if `workflowId` is empty/blank — an empty id would silently produce a
 * URL that targets every workflow, which is exactly the misconfiguration this
 * feature exists to surface.
 */
export function buildWebhookUrl(
  provider: WebhookProvider,
  workflowId: string,
): string {
  const trimmedId = workflowId.trim();
  if (!trimmedId) {
    throw new Error("buildWebhookUrl: workflowId is required");
  }

  const receiver = RECEIVER_PATH[provider];
  const base = resolveAppUrl();

  return `${base}/api/webhooks/${receiver}?workflowId=${encodeURIComponent(
    trimmedId,
  )}`;
}
