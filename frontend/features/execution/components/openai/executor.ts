import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";
import { createOpenAI } from "@ai-sdk/openai";
import type { NodeExecutor } from "@/features/execution/types";
import { publishNodeStatus } from "@/features/execution/lib/publish-execution-event";
import {
  generateDiscordAiOutput,
  generateGeneralAiOutput,
  OPENAI_STRUCTURED_OUTPUT_MODEL,
  shouldUseTeacherFeedbackMode,
} from "@/lib/ai/generate-discord-ai-output";
import {
  createAiNodeOutput,
  mergeOpenAiIntoContext,
} from "@/lib/ai/workflow-context";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { makeStepId } from "@/features/execution/lib/step-id";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type OpenAiData = {
  variableName?: string;
  credentialId?: string;
  systemPrompt?: string;
  userPrompt?: string;
};

export const openAiExecutor: NodeExecutor<OpenAiData> = async ({
  data,
  nodeId,
  userId,
  nodeType,
  workflowId,
  context,
  step,
  publish,
  iterationKey,
}) => {
  await publishNodeStatus(publish, workflowId, nodeId, nodeType, "loading");

  if (!data.variableName) {
    await publishNodeStatus(publish, workflowId, nodeId, nodeType, "error");
    throw new NonRetriableError("OpenAi node: Variable name is missing");
  }

  if (!data.credentialId) {
    await publishNodeStatus(publish, workflowId, nodeId, nodeType, "error");
    throw new NonRetriableError("OpenAI node: Credential is required");
  }

  if (!data.userPrompt) {
    await publishNodeStatus(publish, workflowId, nodeId, nodeType, "error");
    throw new NonRetriableError("OpenAi node: User prompt is missing");
  }

  const systemPrompt = data.systemPrompt
    ? Handlebars.compile(data.systemPrompt)(context)
    : "You are a helpful assistant.";

  const userPromptTemplate = data.userPrompt.replace(
    /\{\{FORM_SUBMISSION_DATA\}\}/gi,
    "{{json googleForm}}",
  );
  const userPrompt = Handlebars.compile(userPromptTemplate)(context);
  const teacherFeedbackMode = shouldUseTeacherFeedbackMode(
    context,
    userPromptTemplate,
  );

  const credential = await step.run(makeStepId("get-credential", nodeId, iterationKey), () => {
    return prisma.credential.findUnique({
      where: {
        id: data.credentialId,
        userId,
      },
    });
  });

  if (!credential) {
    await publishNodeStatus(publish, workflowId, nodeId, nodeType, "error");
    throw new NonRetriableError("OpenAI node: Credential not found");
  }

  const openai = createOpenAI({
    apiKey: decrypt(credential.value),
  });

  try {
    const generate =
      teacherFeedbackMode ? generateDiscordAiOutput : generateGeneralAiOutput;
    const stepBase = teacherFeedbackMode
      ? "openai-generate-structured"
      : "openai-generate-text";

    const result = await step.ai.wrap(
      makeStepId(stepBase, nodeId, iterationKey),
      generate,
      {
        structuredModel: openai(OPENAI_STRUCTURED_OUTPUT_MODEL),
        fallbackModel: openai("gpt-4"),
        systemPrompt,
        userPrompt,
      },
    );

    if (result.usedFallback) {
      logger.warn("openai.structured_output.fallback", {
        workflowId,
        nodeId,
        modelUsed: result.modelUsed,
      });
    }

    await publishNodeStatus(publish, workflowId, nodeId, nodeType, "success");

    const entry = createAiNodeOutput(
      result.message,
      result.structured,
    );

    return mergeOpenAiIntoContext(context, data.variableName, entry);
  } catch (error) {
    await publishNodeStatus(publish, workflowId, nodeId, nodeType, "error");

    const message =
      error instanceof Error ? error.message : "OpenAI generation failed";
    throw new NonRetriableError(`OpenAI node: ${message}`);
  }
};
