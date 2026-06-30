import { NodeType } from "@/generated/prisma/enums";

/**
 * Short, regex-safe slugs used to build unique variable names per node.
 * The resulting `${slug}_${index + 1}` always matches the variable-name
 * rule enforced by the node config dialogs: `^[A-Za-z_$][A-Za-z0-9_$]*$`.
 */
const VARIABLE_NAME_SLUG: Partial<Record<NodeType, string>> = {
  [NodeType.OPENAI]: "openai",
  [NodeType.ANTHROPIC]: "anthropic",
  [NodeType.GEMINI]: "gemini",
  [NodeType.DISCORD]: "discord",
  [NodeType.SLACK]: "slack",
  [NodeType.HTTP_REQUEST]: "http",
  [NodeType.LOOP]: "loop",
};

const AI_NODE_TYPES: ReadonlySet<NodeType> = new Set([
  NodeType.OPENAI,
  NodeType.ANTHROPIC,
  NodeType.GEMINI,
]);

export interface DefaultDataOptions {
  /** Zero-based position of the node within the generated plan. */
  index: number;
  /** Variable name produced by the closest upstream node, if any. */
  upstreamVarName?: string;
}

/**
 * Build a deterministic, valid `variableName` for a node that needs one.
 * Returns `undefined` for node types that do not use a variable name.
 */
function variableNameFor(type: NodeType, index: number): string | undefined {
  const slug = VARIABLE_NAME_SLUG[type];
  if (!slug) return undefined;
  return `${slug}_${index + 1}`;
}

/**
 * Produce sensible DEFAULT `node.data` for a freshly generated node, matching
 * the real shape each node component expects. Pure and data-only: it never
 * imports React or component code.
 *
 * Required-but-unknowable fields (credential ids, webhook urls) are left empty
 * so the user is prompted to fill them in via the node's own dialog.
 */
export function defaultDataForNode(
  type: NodeType,
  opts: DefaultDataOptions,
): Record<string, unknown> {
  const { index, upstreamVarName } = opts;
  const variableName = variableNameFor(type, index);

  if (AI_NODE_TYPES.has(type)) {
    const userPrompt = upstreamVarName
      ? `Summarize the following data:\n{{json ${upstreamVarName}}}`
      : "Summarize the input and respond concisely.";
    return {
      variableName,
      credentialId: "",
      systemPrompt: "You are a helpful assistant.",
      userPrompt,
    };
  }

  switch (type) {
    case NodeType.DISCORD:
      return {
        variableName,
        webhookUrl: "",
        aiSourceVariable: upstreamVarName ?? "",
      };
    case NodeType.SLACK:
      return {
        variableName,
        webhookUrl: "",
        content: upstreamVarName ? `{{${upstreamVarName}.text}}` : "",
      };
    case NodeType.HTTP_REQUEST:
      return {
        variableName,
        endpoint: "",
        method: "GET",
      };
    case NodeType.LOOP:
      return { variableName };
    default:
      // Triggers and any unknown types carry no default data; they are
      // configured later through their own procedures/dialogs.
      return {};
  }
}
