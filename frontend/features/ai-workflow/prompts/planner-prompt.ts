import type { buildCapabilities } from "@/features/ai-workflow/capabilities/registry";

/**
 * The capability snapshot produced by `buildCapabilities()`. Derived from the
 * registry's return type so this module stays in sync with Unit 1's contract.
 */
export type CapabilitySnapshot = ReturnType<typeof buildCapabilities>;

type NodeLike = {
  nodeType: string;
  label?: string;
  description?: string;
};

type CredentialLike = {
  type?: string;
  label?: string;
  description?: string;
};

type ConnectionRuleLike = {
  from?: string;
  to?: string;
  description?: string;
};

function formatNode(node: NodeLike): string {
  const name = node.label ?? node.nodeType;
  const description = node.description ? ` — ${node.description}` : "";

  return `- nodeType: "${node.nodeType}" (${name})${description}`;
}

function formatTriggers(snapshot: CapabilitySnapshot): string {
  const triggers = (snapshot.triggers ?? []) as NodeLike[];

  if (triggers.length === 0) {
    return "(none available)";
  }

  return triggers.map(formatNode).join("\n");
}

function formatActions(snapshot: CapabilitySnapshot): string {
  const actions = (snapshot.actions ?? []) as NodeLike[];

  if (actions.length === 0) {
    return "(none available)";
  }

  return actions.map(formatNode).join("\n");
}

function formatCredentialTypes(snapshot: CapabilitySnapshot): string {
  const credentialTypes = (snapshot.credentialTypes ?? []) as Array<
    CredentialLike | string
  >;

  if (credentialTypes.length === 0) {
    return "(none)";
  }

  return credentialTypes
    .map((credential) => {
      if (typeof credential === "string") {
        return `- ${credential}`;
      }

      const name = credential.type ?? credential.label ?? "unknown";
      const description = credential.description ? ` — ${credential.description}` : "";

      return `- ${name}${description}`;
    })
    .join("\n");
}

function formatConnectionRules(snapshot: CapabilitySnapshot): string {
  const rules = (snapshot.connectionRules ?? []) as Array<
    ConnectionRuleLike | string
  >;

  if (rules.length === 0) {
    return "(no special restrictions beyond using only supported node types)";
  }

  return rules
    .map((rule) => {
      if (typeof rule === "string") {
        return `- ${rule}`;
      }

      if (rule.from && rule.to) {
        const description = rule.description ? ` — ${rule.description}` : "";

        return `- "${rule.from}" -> "${rule.to}"${description}`;
      }

      return `- ${rule.description ?? JSON.stringify(rule)}`;
    })
    .join("\n");
}

/**
 * Build the deterministic system prompt for the AI workflow planner. It embeds
 * the live capability snapshot so the model can only reference real node types,
 * and it spells out the anti-hallucination contract the model must follow.
 */
export function buildPlannerSystemPrompt(capabilities: CapabilitySnapshot): string {
  return [
    "You are FlowForge's AI Workflow Planner.",
    "Given a user request, you produce a STRUCTURED PLAN for an automation workflow.",
    "You DO NOT create, save, or execute anything — you only describe a plan.",
    "",
    "## Available trigger nodes",
    "A workflow starts with exactly one trigger. You may only use these triggers:",
    formatTriggers(capabilities),
    "",
    "## Available action nodes",
    "Steps after the trigger must use only these action nodes:",
    formatActions(capabilities),
    "",
    "## Available credential types",
    formatCredentialTypes(capabilities),
    "",
    "## Connection rules",
    formatConnectionRules(capabilities),
    "",
    "## Hard rules (anti-hallucination)",
    '1. Each step\'s "nodeType" MUST be copied EXACTLY from the trigger or action lists above. Never invent, rename, or guess a nodeType.',
    "2. If the user asks for something that no listed node supports (for example a Gmail trigger, a Slack action, or any unlisted service), DO NOT fabricate a node for it.",
    '   Instead set "possible" to false, write a clear "reason" explaining what is unsupported, and provide "suggestions" — typically using an HTTP Request node to call the service\'s API, or building a new custom node.',
    '3. If the request can be fully satisfied with supported nodes, set "possible" to true and list the steps in execution order.',
    '4. Always include a human-readable "explanation" array describing, step by step, what the workflow does and why.',
    "5. Leave all external configuration for the user: do NOT invent webhook URLs, form IDs, channel IDs, API keys, or credential values. Reference that the user must supply them.",
    '6. Record any requested-but-unsupported capabilities in "unsupportedFeatures".',
    "",
    "Be deterministic and concise. Prefer the smallest correct plan. Only return data that conforms to the provided schema.",
  ].join("\n");
}

/**
 * Build the user prompt wrapping the raw natural-language request.
 */
export function buildPlannerUserPrompt(userPrompt: string): string {
  return [
    "Plan a workflow for the following request. Use only supported node types.",
    "",
    "Request:",
    userPrompt.trim(),
  ].join("\n");
}
