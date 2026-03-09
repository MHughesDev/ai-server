/**
 * RequestEnvelope – external API contract for POST /v1/query.
 * @see docs/SPEC/02_API_Contracts.md, docs/Overview.md
 */
import { z } from "zod";
const CallerSchema = z.object({
    app_id: z.string().min(1),
    user_id: z.string().min(1),
    org_id: z.string().min(1),
    session_id: z.string().optional(),
    scopes: z.array(z.string()).default([]),
});
const AttachmentSchema = z.object({
    id: z.string().min(1),
    type: z.enum(["image", "pdf", "json", "other"]),
    content_b64: z.string().optional(),
    uri: z.string().url().optional(),
    meta: z
        .object({
        filename: z.string().optional(),
        mime: z.string().optional(),
    })
        .optional(),
});
const InputSchema = z.object({
    text: z.string().optional(),
    attachments: z.array(AttachmentSchema).default([]),
    structured: z.record(z.unknown()).optional(),
});
const PreferencesSchema = z
    .object({
    response_format: z.enum(["text", "json", "markdown"]).default("text"),
    verbosity: z.enum(["low", "medium", "high"]).default("medium"),
    stream: z.boolean().default(false),
})
    .strict();
export const RequestEnvelopeSchema = z
    .object({
    request_id: z.string().uuid(),
    caller: CallerSchema,
    input: InputSchema.default({}),
    preferences: PreferencesSchema.default({}),
    /** Sync-only API: mode is optional but may only be "sync" when provided. */
    mode: z.literal("sync").optional(),
    /** Wall-clock deadline in ms */
    deadline_ms: z.number().int().positive().optional(),
    /** Contract version for compatibility; only v1 supported (enforced at ingress) */
    contract_version: z.string().default("v1"),
})
    .strict();
//# sourceMappingURL=request-envelope.js.map