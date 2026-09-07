# Integrations

## Overview

Each node type in FlowForge integrates with an external service. This document details the behavior, configuration, and data contracts for every integration.

All integrations are implemented as executor functions that run inside the Inngest durable function (`inngest/functions.ts`).

---

## HTTP Request

**Node type**: `HTTP_REQUEST`  
**Executor**: `features/execution/components/http-request/executor.ts`  
**Purpose**: Make arbitrary outbound HTTP calls to any URL.

### Configuration Fields (`node.data`)
| Field | Type | Required | Description |
|---|---|---|---|
| `variableName` | string | Yes | Context key to store the response under |
| `endpoint` | string | Yes | Target URL (Handlebars template supported) |
| `method` | string | Yes | `GET`, `POST`, `PUT`, `PATCH`, or `DELETE` |
| `body` | string | POST/PUT/PATCH only | JSON request body (Handlebars template supported) |

### Behavior
1. Resolves `endpoint` via Handlebars: `Handlebars.compile(data.endpoint)(context)`.
2. For POST/PUT/PATCH: resolves `body` via Handlebars, validates it is valid JSON.
3. Makes request via `ky`.
4. Detects response content type: parses JSON if `content-type` includes `application/json`, otherwise reads as text.
5. Stores result in context.

### Output Shape
```ts
context[variableName] = {
  httpResponse: {
    status: number;
    statusText: string;
    data: object | string;   // JSON-parsed or raw text
  }
}
```

### Template Examples
```
Endpoint: https://api.example.com/feedback/{{googleForm.responseId}}
Body: { "score": {{aiOutput.structured.rating_out_of_10}}, "name": "{{googleForm.respondentEmail}}" }
```

---

## OpenAI

**Node type**: `OPENAI`  
**Executor**: `features/execution/components/openai/executor.ts`  
**Model**: `gpt-4o-mini` (primary), `gpt-4` (fallback)  
**Purpose**: Generate structured AI output (optimized for teacher feedback schema).

### Configuration Fields
| Field | Type | Required | Description |
|---|---|---|---|
| `variableName` | string | Yes | Context key for AI output |
| `credentialId` | string | Yes | ID of an OPENAI credential |
| `systemPrompt` | string | No | System instructions (Handlebars template) |
| `userPrompt` | string | Yes | User message (Handlebars template) |

### Behavior
1. Resolves system and user prompts via Handlebars.
   - Legacy: `{{FORM_SUBMISSION_DATA}}` in the user prompt is replaced with `{{json googleForm}}`.
2. Fetches and decrypts the OPENAI credential.
3. Calls `generateDiscordAiOutput()` with structured and fallback models.
4. The `generateDiscordAiOutput` function:
   - Attempts `generateObject()` with `gpt-4o-mini` and `teacherFeedbackSchema`.
   - If structured output is unsupported, falls back to `generateText()` with `gpt-4` + JSON suffix prompt.
   - Parses JSON from text output if possible.

### TeacherFeedback Schema
```ts
{
  teacher_name: string;
  rating_out_of_10: number;   // 0-10
  rating_explanation: string;
  pros: string[];
  cons: string[];
}
```
This schema is the current structured output target — the OpenAI node is specialized for generating teacher feedback.

### Output Shape
```ts
context[variableName] = {
  text: string;              // Formatted message (ready for Discord)
  structured?: {             // TeacherFeedback object if structured output succeeded
    teacher_name: string;
    rating_out_of_10: number;
    rating_explanation: string;
    pros: string[];
    cons: string[];
  }
}
```

### Logs
- `openai.structured_output.fallback` — logged if gpt-4o-mini failed and gpt-4 was used.

---

## Anthropic (Claude)

**Node type**: `ANTHROPIC`  
**Executor**: `features/execution/components/anthropic/executor.ts`  
**Model**: `claude-sonnet-4-5`  
**Purpose**: General-purpose AI text generation.

### Configuration Fields
| Field | Type | Required | Description |
|---|---|---|---|
| `variableName` | string | Yes | Context key for AI output |
| `credentialId` | string | Yes | ID of an ANTHROPIC credential |
| `systemPrompt` | string | No | System instructions (Handlebars template) |
| `userPrompt` | string | Yes | User message (Handlebars template) |

### Behavior
1. Resolves prompts via Handlebars against context.
2. Fetches and decrypts the ANTHROPIC credential.
3. Calls `step.ai.wrap("anthropic-generate-text", generateText, { model, system, prompt })`.
4. Extracts text from `steps[0].content[0].text`.
5. Stores result under `variableName`.

### Output Shape
```ts
context[variableName] = {
  text: string;   // Generated text
}
```

---

## Gemini (Google)

**Node type**: `GEMINI`  
**Executor**: `features/execution/components/gemini/executor.ts`  
**Model**: `gemini-2.0-flash`  
**Purpose**: General-purpose AI text generation (Google's model).

### Configuration Fields
Same as Anthropic: `variableName`, `credentialId`, `systemPrompt`, `userPrompt`.

### Behavior
Same as Anthropic but uses `createGoogleGenerativeAI` from `@ai-sdk/google`.

### Output Shape
```ts
context[variableName] = {
  text: string;
}
```

---

## Discord

**Node type**: `DISCORD`  
**Executor**: `features/execution/components/discord/executor.ts`  
**Purpose**: Post AI-generated content to a Discord channel via incoming webhook.

### Configuration Fields
| Field | Type | Required | Description |
|---|---|---|---|
| `variableName` | string | Yes | Context key for Discord output |
| `webhookUrl` | string | Yes | Discord incoming webhook URL |
| `aiSourceVariable` | string | Recommended | Variable name of an upstream AI node (e.g., `myOpenAiOutput`) |
| `username` | string | No | Override display name for the bot (Handlebars supported) |
| `content` | string | Legacy | Handlebars template (deprecated in favor of `aiSourceVariable`) |

### Behavior
1. **Resolve AI source**: Reads `data.aiSourceVariable` to find which context variable holds the AI output.
   - Legacy fallback: if `aiSourceVariable` is absent, falls back to rendering `data.content` Handlebars template.
2. **Assert AI source in context**: Verifies the variable exists in context.
3. **Validate AI output**: Calls `validateAndExtractDiscordMessage(aiOutput.text)`.
   - Expected format: The AI output text should contain the Discord message (possibly with JSON fallback).
4. **Post to Discord**: `sendDiscordWebhook({ webhookUrl, payload: { content } })`.
5. Retryable vs non-retryable errors: Discord API errors with `retryable: false` throw `NonRetriableError`; others throw plain `Error`.

### Output Shape
```ts
context[variableName] = {
  messageContent: string;   // The message that was posted
}
```

### `sendDiscordWebhook` (`lib/discord/send-webhook.ts`)
Handles the HTTP POST to the Discord webhook URL:
- Returns `{ ok: true }` on success.
- Returns `{ ok: false, message, discordMessage?, code?, retryable: boolean }` on failure.
- Parses Discord API error responses.
- Sets `retryable: false` for 4xx client errors (bad webhook URL, invalid payload).

### AI Source Resolution (`lib/ai/resolve-ai-source.ts`)
Given `{ aiSourceVariable?, legacyContentTemplate? }`:
- If `aiSourceVariable` is set → returns `{ variableName }`.
- If `content` template is set → returns `{ variableName: "content" }` (legacy).
- Otherwise → returns `{ error: "no AI source configured" }`.

---

## Slack

**Node type**: `SLACK`  
**Executor**: `features/execution/components/slack/executor.ts`  
**Purpose**: Post a message to a Slack channel via incoming webhook.

### Configuration Fields
| Field | Type | Required | Description |
|---|---|---|---|
| `variableName` | string | Yes | Context key for output |
| `webhookUrl` | string | Yes | Slack incoming webhook URL |
| `content` | string | Yes | Message content (Handlebars template) |

### Behavior
1. Compiles `data.content` template via Handlebars against context.
2. Decodes HTML entities via `html-entities`.
3. POSTs `{ content }` to the Slack webhook URL via `ky`.
4. Stores the sent content (truncated to 2000 chars) in context.

### Output Shape
```ts
context[variableName] = {
  messageContent: string;   // Sent message (max 2000 chars)
}
```

> Note: The Slack webhook `payload` uses `content` as the key — this is not the standard Slack `text` field. Verify your Slack incoming webhook configuration accepts this format.

---

## Trigger Nodes as Integrations

### Google Form Trigger
See [Triggers documentation](./triggers.md#google-form-trigger).

Data available in context as `context.googleForm`:
```ts
{
  formId, formTitle, responseId, timestamp,
  respondentEmail, responses, raw
}
```

### Stripe Trigger
See [Triggers documentation](./triggers.md#stripe-trigger).

Data available in context as `context.stripe`:
```ts
{
  eventId, eventType, timestamp, livemode, raw
}
```

---

## Context Variable Naming

Each integration stores output under a **user-defined variable name** (`data.variableName`). This name:
- Must be unique within a workflow (otherwise later nodes overwrite earlier ones).
- Is used in Handlebars templates downstream: `{{myVarName.text}}`.
- Is stored in `node.data.variableName` in the database.

Conventions used in the codebase:
- `ff` prefix + integration name (e.g., `ffopenai`, `ffdiscord`) — this is a UI default pattern.
- Any valid JavaScript identifier works.

---

## Handlebars Template Reference

All executor nodes support Handlebars templating in text fields:

| Syntax | Description |
|---|---|
| `{{variableName}}` | Insert a context value (string) |
| `{{variableName.field}}` | Access a nested field |
| `{{json variableName}}` | Insert value as formatted JSON |
| `{{#if condition}}...{{/if}}` | Conditional block |
| `{{#each array}}...{{/each}}` | Iterate array |

**Available context keys** depend on what nodes have run before:
- `googleForm.*` — after a GOOGLE_FORM_TRIGGER
- `stripe.*` — after a STRIPE_TRIGGER
- `myAiVar.*` — after an AI node with `variableName: "myAiVar"`
- `myHttpVar.*` — after an HTTP_REQUEST node
