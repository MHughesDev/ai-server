/**
 * CanonicalRequest – internal unified representation after multimodal parsing.
 * @see Docs/Overview.md, Docs/Architecture.md (6.1)
 */
import { z } from "zod";
/** Attachment handle after canonicalization (no raw content in spine) */
const AttachmentHandleSchema = z.object({
    id: z.string(),
    type: z.enum(["image", "pdf", "json", "other"]),
    uri: z.string().optional(),
    token_estimate: z.number().int().min(0).optional(),
    mime: z.string().optional(),
});
export const CanonicalRequestSchema = z.object({
    request_id: z.string().uuid(),
    /** Modality tags present in this request */
    modalities: z.array(z.enum(["text", "image", "file", "structured"])).default(["text"]),
    /** Normalized text content (single string after concatenation) */
    text: z.string().default(""),
    /** Attachment handles only; no inline content */
    attachments: z.array(AttachmentHandleSchema).default([]),
    /** Optional structured payload */
    structured: z.record(z.unknown()).optional(),
    /** Estimated input tokens for budgeting */
    token_estimate: z.number().int().min(0).default(0),
    /** Original caller/context identifiers (pass-through) */
    caller_app_id: z.string().min(1),
    caller_user_id: z.string().min(1),
    caller_org_id: z.string().min(1),
    session_id: z.string().optional(),
    conversation_id: z.string().optional(),
});
//# sourceMappingURL=canonical-request.js.map