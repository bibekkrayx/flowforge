# Example Workflow: Google Form → OpenAI → Discord

This workflow demonstrates receiving Google Form responses, processing them through OpenAI to generate structured teacher feedback, and posting the result to Discord.

## Use Case

An educational platform wants to automatically collect student feedback, run it through AI to produce a structured evaluation, and post the evaluation to a Discord channel.

## Node Configuration

### Node 1: GOOGLE_FORM_TRIGGER
- **Form ID**: Set to your Google Form's ID.
- **Webhook URL**: Copy from node settings and configure in your Google Form Apps Script.
- **Context output**: `googleForm.responses`, `googleForm.formTitle`, `googleForm.respondentEmail`, etc.

### Node 2: OPENAI
- **Variable Name**: `feedbackAI`
- **Credential**: Select your OPENAI credential.
- **System Prompt**:
  ```
  You are a helpful teaching assistant evaluating student feedback about teachers.
  Provide structured, constructive feedback based on the form responses.
  ```
- **User Prompt**:
  ```
  Here is the student feedback submission for {{googleForm.formTitle}}:
  
  {{json googleForm.responses}}
  
  Please evaluate the teacher based on this feedback.
  ```
- **Context output**: `feedbackAI.text` (formatted Discord message), `feedbackAI.structured` (TeacherFeedback object).

### Node 3: DISCORD
- **Variable Name**: `discordPost`
- **Webhook URL**: Your Discord channel incoming webhook URL.
- **AI Source Variable**: `feedbackAI` (references the OPENAI node output).
- **Context output**: `discordPost.messageContent`.

## Data Flow

```
context.googleForm = {
  formTitle: "Teacher Feedback Form",
  responses: { "Teacher name": "John Smith", "Rating": "4/5", ... },
  respondentEmail: "student@example.com"
}
     ↓  [OPENAI node]
context.feedbackAI = {
  text: "**Feedback for John Smith** ⭐7/10 ...",
  structured: {
    teacher_name: "John Smith",
    rating_out_of_10: 7,
    rating_explanation: "...",
    pros: [...],
    cons: [...]
  }
}
     ↓  [DISCORD node]
context.discordPost = {
  messageContent: "**Feedback for John Smith** ⭐7/10 ..."
}
```

## Important Notes

- The OpenAI node uses `gpt-4o-mini` with structured output (TeacherFeedback schema). See [integrations.md](../features/integrations.md#openai) for the full schema.
- The Discord node validates that the AI output matches the expected format before posting. It does not post raw AI text directly.
- The `discordExecutor` reads `context[aiSourceVariable]` (i.e., `context.feedbackAI`) and calls `validateAndExtractDiscordMessage()` on the `.text` field.
- If the AI output is invalid or missing, the Discord node throws `NonRetriableError` and fails the execution.

## Apps Script (Google Form Setup)

See [triggers.md](../features/triggers.md#google-form-apps-script-setup) for the full Apps Script code to send form submissions to the FlowForge webhook.
