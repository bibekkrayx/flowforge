# Credentials

## Overview

The Credentials feature provides a secure vault for storing third-party API keys. Keys are encrypted at rest and decrypted only inside Inngest executor functions at execution time. The plaintext key is never logged, stored, or returned to the browser.

---

## Supported Credential Types

| Type | Used by Node | API it authenticates |
|---|---|---|
| `OPENAI` | OPENAI | OpenAI API (ChatGPT, gpt-4o, etc.) |
| `ANTHROPIC` | ANTHROPIC | Anthropic API (Claude models) |
| `GEMINI` | GEMINI | Google Generative AI (Gemini models) |
| `DISCORD` | DISCORD | (Note: Discord webhooks don't need a key — this type exists for potential future bot token support) |
| `SLACK` | SLACK | (Same note as Discord — webhook-based nodes don't use this) |

> Currently, the DISCORD and SLACK nodes use webhook URLs configured directly in node data, not stored credentials. The `DISCORD` and `SLACK` credential types exist in the enum but are not actively used by the executors.

---

## User Flow

1. User navigates to `/credentials`.
2. User clicks "New Credential" (requires Pro subscription).
3. User fills: name, type, API key value.
4. On submit: `trpc.credentials.create.mutate({ name, type, value })`.
5. Server encrypts the value and saves the record.
6. User builds a workflow and selects this credential in an AI node's dialog.
7. At execution time, the executor fetches the credential record and decrypts the value.

---

## Architecture

### Storage (`Credential` model)

```
Credential {
  id          String
  name        String        (user-defined display name)
  value       String        (AES-encrypted ciphertext of the API key)
  type        CredentialType
  userId      String        (owner)
}
```

### Encryption (`lib/encryption.ts`)

```ts
import Cryptr from "cryptr";

const cryptr = new Cryptr(process.env.ENCRYPTION_KEY);

export const encrypt = (text: string) => cryptr.encrypt(text);
export const decrypt = (text: string) => cryptr.decrypt(text);
```

- **Algorithm**: AES-256-GCM (Cryptr v6 default).
- **Key**: `ENCRYPTION_KEY` environment variable.
- **Lazy init**: Cryptr instance created on first call.

### Encryption Points
- `credentials.create` mutation: `encrypt(input.value)` before `prisma.credential.create`.
- `credentials.update` mutation: `encrypt(input.value)` before `prisma.credential.update`.

### Decryption Points
- OPENAI executor: `decrypt(credential.value)` to get the OpenAI API key.
- ANTHROPIC executor: `decrypt(credential.value)` to get the Anthropic API key.
- GEMINI executor: `decrypt(credential.value)` to get the Google API key.

All decryption happens inside `step.run()` within Inngest functions — never in a browser context.

---

## tRPC Procedures

### `credentials.create` (premiumProcedure)
- Validates: name (min 1), type (enum), value (min 1).
- Encrypts value.
- Inserts record owned by `ctx.auth.user.id`.

### `credentials.update` (protectedProcedure)
- Validates same fields.
- Encrypts new value.
- Updates only if `userId` matches (prevents cross-user updates).

### `credentials.remove` (protectedProcedure)
- Deletes credential where `id` AND `userId` match.

### `credentials.getOne` (protectedProcedure)
- Returns credential record.
- Note: `value` field in the response is the **encrypted ciphertext** (Cryptr-encrypted string), not plaintext. The browser never sees the plaintext key.

### `credentials.getMany` (protectedProcedure)
- Returns paginated list with name search.
- `pageSize` default 5, max 100.

### `credentials.getByType` (protectedProcedure)
- Returns all credentials of a given type for the user.
- Used in node dialogs to populate the "Select Credential" dropdown.

---

## UI Components

### Credential List (`features/credentials/components/credentials.tsx`)
- Paginated table at `/credentials`.
- Columns: name, type, created date, actions (edit, delete).
- Search by name via URL state (nuqs).

### Credential Form (`features/credentials/components/credential.tsx`)
- Used on `/credentials/new` and `/credentials/[id]`.
- Form fields: name (text), type (select), value (password input).
- On submit: create or update mutation.

---

## Assigning Credentials to Nodes

In AI node configuration dialogs (OpenAI, Anthropic, Gemini), there is a "Credential" dropdown that calls `trpc.credentials.getByType.useQuery({ type: "OPENAI" })` to list credentials of the matching type.

The selected credential ID is stored in `node.data.credentialId`. At execution time, the executor fetches:
```ts
const credential = await prisma.credential.findUnique({
  where: { id: data.credentialId, userId },
});
```

The `userId` check in the query ensures users can only use their own credentials.

---

## Security Notes

| Concern | Implementation |
|---|---|
| Plaintext key storage | Never stored; only ciphertext in DB |
| Key exposure to browser | Never returned in API responses |
| Key scope | userId on all queries; cross-user access impossible |
| Encryption key compromise | If `ENCRYPTION_KEY` leaks, all values can be decrypted — treat it as a critical secret |
| Key rotation | No rotation mechanism — changing `ENCRYPTION_KEY` breaks all existing credentials |
| DISCORD/SLACK webhook URLs | Stored in node `data` as plaintext (not encrypted) — these are less sensitive than API keys |

---

## Edge Cases

- **Deleting a credential used by nodes**: The `credentialId` on `Node` is nullable. If the credential is deleted, `credentialId` remains set but the lookup returns null. The executor will throw `NonRetriableError("Credential not found")` at execution time.
- **Credential type mismatch**: If a user assigns an ANTHROPIC credential to an OPENAI node, the API call will fail with an authentication error from the provider — the application does not validate type at assignment time.
- **Missing `ENCRYPTION_KEY`**: The `getCryptr()` function throws immediately if the env var is absent, causing all credential operations to fail at startup.
