import { describe, expect, it } from "vitest";
import {
  isStructuredOutputUnsupported,
  shouldUseTeacherFeedbackMode,
} from "@/lib/ai/generate-discord-ai-output";

describe("shouldUseTeacherFeedbackMode", () => {
  it("returns true when googleForm is in context", () => {
    expect(
      shouldUseTeacherFeedbackMode(
        { googleForm: { responses: {} } },
        "Summarize this",
      ),
    ).toBe(true);
  });

  it("returns true when the prompt references googleForm", () => {
    expect(
      shouldUseTeacherFeedbackMode({}, "Review {{json googleForm}}"),
    ).toBe(true);
  });

  it("returns false for general workflows like news briefings", () => {
    expect(
      shouldUseTeacherFeedbackMode(
        { news: { httpResponse: { data: [] } } },
        "Generate today's news briefing.",
      ),
    ).toBe(false);
  });
});

describe("isStructuredOutputUnsupported", () => {
  it("detects json_schema unsupported errors", () => {
    const error = new Error(
      "Invalid parameter: 'text.format' of type 'json_schema' is not supported with model version `gpt-4`.",
    );
    expect(isStructuredOutputUnsupported(error)).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isStructuredOutputUnsupported(new Error("rate limit"))).toBe(false);
  });
});
