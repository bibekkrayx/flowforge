import { generateObject, generateText, type LanguageModel } from "ai";
import { formatTeacherFeedbackForDiscord } from "@/lib/ai/format-teacher-feedback-for-discord";
import {
  teacherFeedbackSchema,
  TEACHER_FEEDBACK_JSON_SUFFIX,
  type TeacherFeedback,
} from "@/lib/ai/teacher-feedback-schema";
import {
  normalizeRawAiOutput,
  truncateForDiscord,
  validateAndExtractDiscordMessage,
} from "@/lib/ai/validate-ai-output";

/** Models that support OpenAI `json_schema` structured output via the AI SDK. */
export const OPENAI_STRUCTURED_OUTPUT_MODEL = "gpt-4o-mini";

export function isStructuredOutputUnsupported(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("json_schema") &&
    (message.includes("not supported") || message.includes("invalid parameter"))
  );
}

type GenerateDiscordAiOutputParams = {
  structuredModel: LanguageModel;
  fallbackModel: LanguageModel;
  systemPrompt: string;
  userPrompt: string;
};

export type GenerateDiscordAiOutputResult = {
  message: string;
  structured?: TeacherFeedback;
  modelUsed: string;
  usedFallback: boolean;
};

/** Teacher-feedback JSON is only for Google Form → OpenAI → Discord flows. */
export function shouldUseTeacherFeedbackMode(
  context: Record<string, unknown>,
  userPromptTemplate: string,
): boolean {
  if (context.googleForm != null) {
    return true;
  }

  if (/\{\{FORM_SUBMISSION_DATA\}\}/i.test(userPromptTemplate)) {
    return true;
  }

  if (/\{\{\s*json\s+googleForm\s*\}\}/i.test(userPromptTemplate)) {
    return true;
  }

  return false;
}

export async function generateGeneralAiOutput(
  params: GenerateDiscordAiOutputParams,
): Promise<GenerateDiscordAiOutputResult> {
  const { text } = await generateText({
    model: params.structuredModel,
    system: params.systemPrompt.trim(),
    prompt: params.userPrompt,
  });

  const validated = validateAndExtractDiscordMessage(text);
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  return {
    message: validated.message,
    modelUsed: OPENAI_STRUCTURED_OUTPUT_MODEL,
    usedFallback: false,
  };
}

function tryParseTeacherFeedbackFromText(text: string): TeacherFeedback | null {
  const normalized = normalizeRawAiOutput(text);
  if (!normalized.startsWith("{")) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(normalized);
    const result = teacherFeedbackSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function generateDiscordAiOutput(
  params: GenerateDiscordAiOutputParams,
): Promise<GenerateDiscordAiOutputResult> {
  const systemPrompt = params.systemPrompt.trim();

  try {
    const { object: rawObject } = await generateObject({
      model: params.structuredModel,
      schema: teacherFeedbackSchema,
      system: systemPrompt,
      prompt: params.userPrompt,
    });

    const feedback = teacherFeedbackSchema.parse(rawObject);
    const message = formatTeacherFeedbackForDiscord(feedback);

    return {
      message,
      structured: feedback,
      modelUsed: OPENAI_STRUCTURED_OUTPUT_MODEL,
      usedFallback: false,
    };
  } catch (error) {
    if (!isStructuredOutputUnsupported(error)) {
      throw error;
    }
  }

  const { text } = await generateText({
    model: params.fallbackModel,
    system: `${systemPrompt}\n\n${TEACHER_FEEDBACK_JSON_SUFFIX}`,
    prompt: params.userPrompt,
  });

  const fromJson = tryParseTeacherFeedbackFromText(text);
  if (fromJson) {
    return {
      message: formatTeacherFeedbackForDiscord(fromJson),
      structured: fromJson,
      modelUsed: "gpt-4",
      usedFallback: true,
    };
  }

  const validated = validateAndExtractDiscordMessage(text);
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  return {
    message: truncateForDiscord(validated.message),
    modelUsed: "gpt-4",
    usedFallback: true,
  };
}
