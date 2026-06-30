import { NodeType } from "@/generated/prisma/enums";

/** A single step in an external-integration setup guide. */
export type SetupGuideStep = {
  title: string;
  detail: string;
  /** When true the panel renders the detail with a copy button (e.g. a webhook URL). */
  copyable?: boolean;
};

/** Step-by-step instructions for configuring one external integration. */
export type SetupGuide = {
  integration: string;
  estimatedMinutes: number;
  steps: SetupGuideStep[];
};

/**
 * Placeholder the guided-setup panel substitutes with the live webhook URL
 * before rendering a copyable step.
 */
export const WEBHOOK_URL_PLACEHOLDER = "{{WEBHOOK_URL}}";

/** Stable keys for each external integration guide. */
export const SETUP_GUIDE_KEYS = {
  GOOGLE_FORM: "google-form",
  DISCORD: "discord",
  STRIPE: "stripe",
  SLACK: "slack",
  GOOGLE_SHEETS: "google-sheets",
  EMAIL: "email",
  SCHEDULE: "schedule",
} as const;

export const SETUP_GUIDES: Record<string, SetupGuide> = {
  [SETUP_GUIDE_KEYS.GOOGLE_FORM]: {
    integration: "Google Form",
    estimatedMinutes: 6,
    steps: [
      {
        title: "Open your Google Form",
        detail: "Go to forms.google.com and open the form you want to trigger this workflow.",
      },
      {
        title: "Open the Apps Script editor",
        detail: "Click the three-dot menu, choose \"Script editor\" (Extensions → Apps Script).",
      },
      {
        title: "Paste the webhook script",
        detail: `Replace the editor contents with a script that POSTs each response to ${WEBHOOK_URL_PLACEHOLDER}.`,
        copyable: true,
      },
      {
        title: "Create an on-submit trigger",
        detail: "In the Apps Script triggers panel, add a trigger on \"From form\" → \"On form submit\".",
      },
      {
        title: "Save and authorize",
        detail: "Save the project and grant the requested permissions when prompted.",
      },
      {
        title: "Submit a test response",
        detail: "Fill out and submit the form once to confirm the workflow receives the event.",
      },
    ],
  },
  [SETUP_GUIDE_KEYS.DISCORD]: {
    integration: "Discord",
    estimatedMinutes: 3,
    steps: [
      {
        title: "Open server settings",
        detail: "In your Discord server, open Server Settings.",
      },
      {
        title: "Go to Integrations",
        detail: "Select Integrations from the settings sidebar.",
      },
      {
        title: "Create a webhook",
        detail: "Click \"Create Webhook\", pick the target channel, and name it.",
      },
      {
        title: "Copy the webhook URL",
        detail: "Click \"Copy Webhook URL\" to copy the generated endpoint.",
      },
      {
        title: "Paste it here",
        detail: "Paste the copied URL into the Discord node's Webhook URL field.",
      },
    ],
  },
  [SETUP_GUIDE_KEYS.STRIPE]: {
    integration: "Stripe",
    estimatedMinutes: 5,
    steps: [
      {
        title: "Open the Stripe dashboard",
        detail: "Sign in at dashboard.stripe.com.",
      },
      {
        title: "Go to Developers → Webhooks",
        detail: "Open the Developers section, then select Webhooks.",
      },
      {
        title: "Add an endpoint",
        detail: "Click \"Add endpoint\" to register a new webhook destination.",
      },
      {
        title: "Paste the generated URL",
        detail: `Set the endpoint URL to ${WEBHOOK_URL_PLACEHOLDER} and select the events to listen for.`,
        copyable: true,
      },
      {
        title: "Send a test event",
        detail: "Use \"Send test webhook\" to confirm Stripe can reach the workflow.",
      },
    ],
  },
  [SETUP_GUIDE_KEYS.SLACK]: {
    integration: "Slack",
    estimatedMinutes: 4,
    steps: [
      {
        title: "Create an incoming webhook app",
        detail: "At api.slack.com/apps, create a new app and add the \"Incoming Webhooks\" feature.",
      },
      {
        title: "Enable incoming webhooks",
        detail: "Toggle \"Activate Incoming Webhooks\" on for the app.",
      },
      {
        title: "Copy the webhook URL",
        detail: "Click \"Add New Webhook to Workspace\", pick a channel, and copy the generated URL.",
      },
      {
        title: "Paste it here",
        detail: "Paste the copied URL into the Slack node's Webhook URL field.",
      },
    ],
  },
  [SETUP_GUIDE_KEYS.GOOGLE_SHEETS]: {
    integration: "Google Sheets",
    estimatedMinutes: 3,
    steps: [
      {
        title: "Open your spreadsheet",
        detail: "Open the Google Sheet this workflow should read from or write to.",
      },
      {
        title: "Share with the service account",
        detail: "Use Share to grant the connected Google Sheets credential edit access.",
      },
      {
        title: "Copy the spreadsheet id",
        detail: "Copy the id from the sheet URL between /d/ and /edit, then paste it into the node.",
      },
    ],
  },
  [SETUP_GUIDE_KEYS.EMAIL]: {
    integration: "Email (Resend)",
    estimatedMinutes: 4,
    steps: [
      {
        title: "Create a Resend API key",
        detail: "At resend.com/api-keys, generate an API key and verify your sending domain.",
      },
      {
        title: "Add a Resend credential",
        detail: "Save the API key as a Resend credential in FlowForge and select it on the node.",
      },
      {
        title: "Set sender and recipient",
        detail: "Configure the from address and recipient(s) for the email node.",
      },
    ],
  },
  [SETUP_GUIDE_KEYS.SCHEDULE]: {
    integration: "Schedule",
    estimatedMinutes: 2,
    steps: [
      {
        title: "Set the cron expression",
        detail: "Define when the workflow runs using a cron expression (e.g. 0 9 * * * for 9am daily).",
      },
      {
        title: "Choose a timezone",
        detail: "Select the timezone the schedule should be evaluated in.",
      },
    ],
  },
};

/** Maps node types to the setup guide that explains their external setup. */
const NODE_TYPE_TO_GUIDE_KEY: Partial<Record<NodeType, string>> = {
  [NodeType.GOOGLE_FORM_TRIGGER]: SETUP_GUIDE_KEYS.GOOGLE_FORM,
  [NodeType.DISCORD]: SETUP_GUIDE_KEYS.DISCORD,
  [NodeType.STRIPE_TRIGGER]: SETUP_GUIDE_KEYS.STRIPE,
  [NodeType.SLACK]: SETUP_GUIDE_KEYS.SLACK,
  [NodeType.GOOGLE_SHEETS]: SETUP_GUIDE_KEYS.GOOGLE_SHEETS,
  [NodeType.EMAIL]: SETUP_GUIDE_KEYS.EMAIL,
  [NodeType.SCHEDULE_TRIGGER]: SETUP_GUIDE_KEYS.SCHEDULE,
};

/** Returns the setup guide for a node type, or undefined when none applies. */
export function getSetupGuideForNode(type: NodeType): SetupGuide | undefined {
  const key = NODE_TYPE_TO_GUIDE_KEY[type];
  return key ? SETUP_GUIDES[key] : undefined;
}
