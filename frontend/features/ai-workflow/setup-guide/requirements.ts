import { CredentialType, NodeType } from "@/generated/prisma/enums";

/** Minimal shape of a node we inspect when deriving configuration requirements. */
export type RequirementNode = {
  id: string;
  type: NodeType | string;
  data?: Record<string, unknown>;
};

/** A single piece of configuration a node still needs (or already has). */
export type RequirementItem = {
  nodeId: string;
  label: string;
  kind: "credential" | "config";
  satisfied: boolean;
};

export type RequirementsResult = {
  items: RequirementItem[];
  status: "complete" | "incomplete";
};

/** The capability contract Unit 1 exposes per node type. */
type NodeCapability = {
  type: NodeType | string;
  label: string;
  kind: string;
  credentialType?: CredentialType;
  requiredConfig: string[];
};

/**
 * Local fallback capabilities, used when the Unit 1 catalog has no entry for a
 * node type (e.g. before that module is merged). Mirrors the contract shape.
 */
const FALLBACK_CAPABILITIES: Partial<Record<NodeType, NodeCapability>> = {
  [NodeType.OPENAI]: {
    type: NodeType.OPENAI,
    label: "OpenAI",
    kind: "ai",
    credentialType: CredentialType.OPENAI,
    requiredConfig: [],
  },
  [NodeType.ANTHROPIC]: {
    type: NodeType.ANTHROPIC,
    label: "Anthropic",
    kind: "ai",
    credentialType: CredentialType.ANTHROPIC,
    requiredConfig: [],
  },
  [NodeType.GEMINI]: {
    type: NodeType.GEMINI,
    label: "Gemini",
    kind: "ai",
    credentialType: CredentialType.GEMINI,
    requiredConfig: [],
  },
  [NodeType.DISCORD]: {
    type: NodeType.DISCORD,
    label: "Discord",
    kind: "action",
    requiredConfig: ["webhookUrl"],
  },
  [NodeType.SLACK]: {
    type: NodeType.SLACK,
    label: "Slack",
    kind: "action",
    requiredConfig: ["webhookUrl"],
  },
  [NodeType.HTTP_REQUEST]: {
    type: NodeType.HTTP_REQUEST,
    label: "HTTP Request",
    kind: "action",
    requiredConfig: ["endpoint"],
  },
  [NodeType.GOOGLE_FORM_TRIGGER]: {
    type: NodeType.GOOGLE_FORM_TRIGGER,
    label: "Google Form Trigger",
    kind: "trigger",
    requiredConfig: ["formId"],
  },
  [NodeType.GOOGLE_SHEETS]: {
    type: NodeType.GOOGLE_SHEETS,
    label: "Google Sheets",
    kind: "action",
    credentialType: CredentialType.GOOGLE_SHEETS,
    requiredConfig: ["spreadsheetId"],
  },
  [NodeType.EMAIL]: {
    type: NodeType.EMAIL,
    label: "Email",
    kind: "action",
    credentialType: CredentialType.RESEND,
    requiredConfig: ["recipient"],
  },
};

/**
 * Maps a catalog `requiredConfig` field name to the node `data` key that holds
 * its value and a human label. Falls back to treating the field name itself as
 * the data key when it is not explicitly mapped.
 */
const CONFIG_FIELD_META: Record<string, { dataKeys: string[]; label: string }> = {
  webhookUrl: { dataKeys: ["webhookUrl"], label: "Set Webhook URL" },
  endpoint: { dataKeys: ["endpoint", "url"], label: "Set Endpoint URL" },
  formId: { dataKeys: ["formId", "googleFormId"], label: "Set Form ID" },
  spreadsheetId: {
    dataKeys: ["spreadsheetId", "sheetId"],
    label: "Set Spreadsheet ID",
  },
  recipient: { dataKeys: ["recipient", "to"], label: "Set Recipient" },
  cron: { dataKeys: ["cron", "cronExpression"], label: "Set Schedule" },
};

type NodeCatalogModule = {
  getNodeCapability: (type: NodeType) => NodeCapability | undefined;
};

/**
 * Resolves the Unit 1 node catalog if it has been merged, otherwise undefined.
 * The catalog is the source of truth; this module degrades to a local fallback
 * map when it is absent (pre-merge) so requirements derivation stays usable.
 */
function loadCatalog(): NodeCatalogModule | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/features/ai-workflow/capabilities/node-catalog") as NodeCatalogModule;
  } catch {
    return undefined;
  }
}

const catalog = loadCatalog();

function resolveCapability(type: NodeType | string): NodeCapability | undefined {
  const fromCatalog = catalog?.getNodeCapability(type as NodeType);
  if (fromCatalog) return fromCatalog;
  return FALLBACK_CAPABILITIES[type as NodeType];
}

function isFilled(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function configFieldMeta(field: string): { dataKeys: string[]; label: string } {
  return (
    CONFIG_FIELD_META[field] ?? {
      dataKeys: [field],
      label: `Set ${field}`,
    }
  );
}

/**
 * Inspects each node against its catalog capability and produces a checklist of
 * the credential and config it still needs. `status` is "complete" only when
 * every derived item is satisfied (an empty checklist counts as complete).
 */
export function deriveRequirements(
  nodes: RequirementNode[],
): RequirementsResult {
  const items: RequirementItem[] = [];

  for (const node of nodes) {
    const capability = resolveCapability(node.type);
    if (!capability) continue;

    const data = node.data ?? {};

    if (capability.credentialType) {
      items.push({
        nodeId: node.id,
        kind: "credential",
        label: `Select ${capability.label} Credential`,
        satisfied: isFilled(data.credentialId),
      });
    }

    for (const field of capability.requiredConfig) {
      const meta = configFieldMeta(field);
      const satisfied = meta.dataKeys.some((key) => isFilled(data[key]));
      items.push({
        nodeId: node.id,
        kind: "config",
        label: meta.label,
        satisfied,
      });
    }
  }

  const status = items.every((item) => item.satisfied)
    ? "complete"
    : "incomplete";

  return { items, status };
}
