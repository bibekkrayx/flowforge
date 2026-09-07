import { NodeType } from "@/generated/prisma/enums";

/** Display metadata for a node type. Safe for server modules (no React). */
export type NodeTypeMetadata = {
  type: NodeType;
  label: string;
  description: string;
};

/**
 * Every node type registered in the editor (`config/node-components.ts`),
 * excluding the internal INITIAL placeholder.
 */
export const REGISTERED_NODE_TYPES = [
  NodeType.HTTP_REQUEST,
  NodeType.MANUAL_TRIGGER,
  NodeType.GOOGLE_FORM_TRIGGER,
  NodeType.STRIPE_TRIGGER,
  NodeType.SCHEDULE_TRIGGER,
  NodeType.EVENT_TRIGGER,
  NodeType.EMAIL,
  NodeType.GOOGLE_SHEETS,
  NodeType.GEMINI,
  NodeType.OPENAI,
  NodeType.ANTHROPIC,
  NodeType.DISCORD,
  NodeType.SLACK,
  NodeType.LOOP,
] as const satisfies readonly NodeType[];

const NODE_METADATA: Record<
  (typeof REGISTERED_NODE_TYPES)[number],
  Omit<NodeTypeMetadata, "type">
> = {
  [NodeType.MANUAL_TRIGGER]: {
    label: "Trigger Manually",
    description:
      "Runs the flow on clicking a button. Good for getting started quickly",
  },
  [NodeType.GOOGLE_FORM_TRIGGER]: {
    label: "Google Form",
    description: "Runs the flow when google form is submitted",
  },
  [NodeType.STRIPE_TRIGGER]: {
    label: "Stripe Event",
    description: "Runs the flow when a Stripe Event is captured",
  },
  [NodeType.SCHEDULE_TRIGGER]: {
    label: "Schedule",
    description: "Runs the flow on a recurring schedule",
  },
  [NodeType.EVENT_TRIGGER]: {
    label: "Event Reminder",
    description: "Runs the flow relative to a calendar event",
  },
  [NodeType.GEMINI]: {
    label: "Gemini",
    description: "Uses Google Gemini to generate text",
  },
  [NodeType.OPENAI]: {
    label: "OpenAI",
    description: "Uses OpenAI to generate text",
  },
  [NodeType.ANTHROPIC]: {
    label: "Anthropic",
    description: "Uses Anthropic to generate text",
  },
  [NodeType.DISCORD]: {
    label: "Discord",
    description: "Send a message to Discord",
  },
  [NodeType.SLACK]: {
    label: "Slack",
    description: "Send a message to Slack",
  },
  [NodeType.HTTP_REQUEST]: {
    label: "HTTP Request",
    description: "Makes an HTTP request",
  },
  [NodeType.LOOP]: {
    label: "Loop / For Each",
    description: "Run downstream nodes once per item in an array",
  },
  [NodeType.EMAIL]: {
    label: "Email",
    description: "Send an email via Resend",
  },
  [NodeType.GOOGLE_SHEETS]: {
    label: "Google Sheets",
    description: "Read rows from a spreadsheet",
  },
};

export function getNodeTypeMetadata(type: NodeType): NodeTypeMetadata {
  const metadata = NODE_METADATA[type as (typeof REGISTERED_NODE_TYPES)[number]];
  if (!metadata) {
    throw new Error(
      `No metadata found for node type "${type}". ` +
        `Add it to config/node-type-metadata.ts and config/node-components.ts.`,
    );
  }
  return { type, ...metadata };
}

/** Trigger options shown in the node picker (UI ordering). */
export const triggerNodeMetadata: NodeTypeMetadata[] = [
  getNodeTypeMetadata(NodeType.MANUAL_TRIGGER),
  getNodeTypeMetadata(NodeType.GOOGLE_FORM_TRIGGER),
  getNodeTypeMetadata(NodeType.STRIPE_TRIGGER),
  getNodeTypeMetadata(NodeType.SCHEDULE_TRIGGER),
  getNodeTypeMetadata(NodeType.EVENT_TRIGGER),
  getNodeTypeMetadata(NodeType.GEMINI),
  getNodeTypeMetadata(NodeType.OPENAI),
  getNodeTypeMetadata(NodeType.ANTHROPIC),
  getNodeTypeMetadata(NodeType.DISCORD),
  getNodeTypeMetadata(NodeType.SLACK),
];

/** Action options shown in the node picker (UI ordering). */
export const executionNodeMetadata: NodeTypeMetadata[] = [
  getNodeTypeMetadata(NodeType.HTTP_REQUEST),
  getNodeTypeMetadata(NodeType.LOOP),
  getNodeTypeMetadata(NodeType.EMAIL),
  getNodeTypeMetadata(NodeType.GOOGLE_SHEETS),
];
