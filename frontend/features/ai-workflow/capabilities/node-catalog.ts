import { nodeComponents } from "@/config/node-components";
import { CredentialType, NodeType } from "@/generated/prisma/enums";
import {
  executionNodes,
  triggerNodes,
  type NodeTypeOption,
} from "@/components/node-selector";
import type { NodeCapability, NodeKind } from "@/features/ai-workflow/types";

/**
 * Node types that are user-selectable triggers. Everything else supported is an
 * action. INITIAL is an internal placeholder and is excluded entirely.
 */
const TRIGGER_TYPES: ReadonlySet<NodeType> = new Set([
  NodeType.MANUAL_TRIGGER,
  NodeType.GOOGLE_FORM_TRIGGER,
  NodeType.STRIPE_TRIGGER,
  NodeType.SCHEDULE_TRIGGER,
  NodeType.EVENT_TRIGGER,
]);

/** Credential a node requires, if any. */
const CREDENTIAL_BY_TYPE: Partial<Record<NodeType, CredentialType>> = {
  [NodeType.OPENAI]: CredentialType.OPENAI,
  [NodeType.ANTHROPIC]: CredentialType.ANTHROPIC,
  [NodeType.GEMINI]: CredentialType.GEMINI,
  [NodeType.EMAIL]: CredentialType.RESEND,
  [NodeType.GOOGLE_SHEETS]: CredentialType.GOOGLE_SHEETS,
};

/** Non-credential, human-readable config fields the user must fill per node. */
const REQUIRED_CONFIG_BY_TYPE: Partial<Record<NodeType, string[]>> = {
  [NodeType.GOOGLE_FORM_TRIGGER]: ["Google Form ID"],
  [NodeType.STRIPE_TRIGGER]: ["Stripe Webhook Endpoint"],
  [NodeType.SCHEDULE_TRIGGER]: ["Cron schedule"],
  [NodeType.EVENT_TRIGGER]: ["Calendar event"],
  [NodeType.HTTP_REQUEST]: ["Endpoint URL"],
  [NodeType.DISCORD]: ["Discord Webhook URL"],
  [NodeType.SLACK]: ["Slack Webhook URL"],
  [NodeType.GOOGLE_SHEETS]: ["Spreadsheet ID"],
  [NodeType.EMAIL]: ["Recipient"],
};

/** Display metadata (label/description) merged from the node-selector. */
const METADATA_BY_TYPE: ReadonlyMap<NodeType, NodeTypeOption> = new Map(
  [...triggerNodes, ...executionNodes].map((option) => [option.type, option]),
);

function kindFor(type: NodeType): NodeKind {
  return TRIGGER_TYPES.has(type) ? "trigger" : "action";
}

function buildCatalogEntry(type: NodeType): NodeCapability {
  const metadata = METADATA_BY_TYPE.get(type);
  if (!metadata) {
    throw new Error(
      `No node-selector metadata found for node type "${type}". ` +
        `Add it to triggerNodes/executionNodes in components/node-selector.tsx.`,
    );
  }

  return {
    type,
    label: metadata.label,
    description: metadata.description,
    kind: kindFor(type),
    credentialType: CREDENTIAL_BY_TYPE[type],
    requiredConfig: REQUIRED_CONFIG_BY_TYPE[type] ?? [],
  };
}

/**
 * The capability catalog, derived dynamically from the existing node registry.
 * INITIAL is excluded because it is an internal placeholder, not user-selectable.
 * Iterating the registry keys means a newly registered node type automatically
 * appears here (and fails loudly if its display metadata is missing).
 */
export const NODE_CATALOG: readonly NodeCapability[] = (
  Object.keys(nodeComponents) as NodeType[]
)
  .filter((type) => type !== NodeType.INITIAL)
  .map(buildCatalogEntry);

export const SUPPORTED_NODE_TYPES: readonly NodeType[] = NODE_CATALOG.map(
  (entry) => entry.type,
);

const CATALOG_BY_TYPE: ReadonlyMap<NodeType, NodeCapability> = new Map(
  NODE_CATALOG.map((entry) => [entry.type, entry]),
);

export function getNodeCapability(type: NodeType): NodeCapability | undefined {
  return CATALOG_BY_TYPE.get(type);
}
