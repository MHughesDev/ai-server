/**
 * CanonicalRequest – internal unified representation after multimodal parsing.
 * @see docs/Overview.md, docs/Architecture_document_Finalized.md (6.1)
 */
import { z } from "zod";
/** Attachment handle after canonicalization (no raw content in spine) */
declare const AttachmentHandleSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["image", "pdf", "json", "other"]>;
    uri: z.ZodOptional<z.ZodString>;
    token_estimate: z.ZodOptional<z.ZodNumber>;
    mime: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "image" | "pdf" | "json" | "other";
    id: string;
    uri?: string | undefined;
    mime?: string | undefined;
    token_estimate?: number | undefined;
}, {
    type: "image" | "pdf" | "json" | "other";
    id: string;
    uri?: string | undefined;
    mime?: string | undefined;
    token_estimate?: number | undefined;
}>;
export declare const CanonicalRequestSchema: z.ZodObject<{
    request_id: z.ZodString;
    /** Modality tags present in this request */
    modalities: z.ZodDefault<z.ZodArray<z.ZodEnum<["text", "image", "file", "structured"]>, "many">>;
    /** Normalized text content (single string after concatenation) */
    text: z.ZodDefault<z.ZodString>;
    /** Attachment handles only; no inline content */
    attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["image", "pdf", "json", "other"]>;
        uri: z.ZodOptional<z.ZodString>;
        token_estimate: z.ZodOptional<z.ZodNumber>;
        mime: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "image" | "pdf" | "json" | "other";
        id: string;
        uri?: string | undefined;
        mime?: string | undefined;
        token_estimate?: number | undefined;
    }, {
        type: "image" | "pdf" | "json" | "other";
        id: string;
        uri?: string | undefined;
        mime?: string | undefined;
        token_estimate?: number | undefined;
    }>, "many">>;
    /** Optional structured payload */
    structured: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /** Estimated input tokens for budgeting */
    token_estimate: z.ZodDefault<z.ZodNumber>;
    /** Original caller/context identifiers (pass-through) */
    caller_app_id: z.ZodString;
    caller_user_id: z.ZodString;
    caller_org_id: z.ZodString;
    session_id: z.ZodOptional<z.ZodString>;
    conversation_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    attachments: {
        type: "image" | "pdf" | "json" | "other";
        id: string;
        uri?: string | undefined;
        mime?: string | undefined;
        token_estimate?: number | undefined;
    }[];
    request_id: string;
    token_estimate: number;
    modalities: ("image" | "text" | "structured" | "file")[];
    caller_app_id: string;
    caller_user_id: string;
    caller_org_id: string;
    session_id?: string | undefined;
    structured?: Record<string, unknown> | undefined;
    conversation_id?: string | undefined;
}, {
    request_id: string;
    caller_app_id: string;
    caller_user_id: string;
    caller_org_id: string;
    session_id?: string | undefined;
    text?: string | undefined;
    attachments?: {
        type: "image" | "pdf" | "json" | "other";
        id: string;
        uri?: string | undefined;
        mime?: string | undefined;
        token_estimate?: number | undefined;
    }[] | undefined;
    structured?: Record<string, unknown> | undefined;
    token_estimate?: number | undefined;
    modalities?: ("image" | "text" | "structured" | "file")[] | undefined;
    conversation_id?: string | undefined;
}>;
export type CanonicalRequest = z.infer<typeof CanonicalRequestSchema>;
export type AttachmentHandle = z.infer<typeof AttachmentHandleSchema>;
export {};
//# sourceMappingURL=canonical-request.d.ts.map