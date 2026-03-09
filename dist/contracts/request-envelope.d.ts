/**
 * RequestEnvelope – external API contract for POST /v1/query.
 * @see docs/SPEC/02_API_Contracts.md, docs/Overview.md
 */
import { z } from "zod";
declare const CallerSchema: z.ZodObject<{
    app_id: z.ZodString;
    user_id: z.ZodString;
    org_id: z.ZodString;
    session_id: z.ZodOptional<z.ZodString>;
    scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    org_id: string;
    app_id: string;
    user_id: string;
    scopes: string[];
    session_id?: string | undefined;
}, {
    org_id: string;
    app_id: string;
    user_id: string;
    session_id?: string | undefined;
    scopes?: string[] | undefined;
}>;
declare const AttachmentSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["image", "pdf", "json", "other"]>;
    content_b64: z.ZodOptional<z.ZodString>;
    uri: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodObject<{
        filename: z.ZodOptional<z.ZodString>;
        mime: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        filename?: string | undefined;
        mime?: string | undefined;
    }, {
        filename?: string | undefined;
        mime?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "image" | "pdf" | "json" | "other";
    id: string;
    content_b64?: string | undefined;
    uri?: string | undefined;
    meta?: {
        filename?: string | undefined;
        mime?: string | undefined;
    } | undefined;
}, {
    type: "image" | "pdf" | "json" | "other";
    id: string;
    content_b64?: string | undefined;
    uri?: string | undefined;
    meta?: {
        filename?: string | undefined;
        mime?: string | undefined;
    } | undefined;
}>;
declare const InputSchema: z.ZodObject<{
    text: z.ZodOptional<z.ZodString>;
    attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["image", "pdf", "json", "other"]>;
        content_b64: z.ZodOptional<z.ZodString>;
        uri: z.ZodOptional<z.ZodString>;
        meta: z.ZodOptional<z.ZodObject<{
            filename: z.ZodOptional<z.ZodString>;
            mime: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            filename?: string | undefined;
            mime?: string | undefined;
        }, {
            filename?: string | undefined;
            mime?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "image" | "pdf" | "json" | "other";
        id: string;
        content_b64?: string | undefined;
        uri?: string | undefined;
        meta?: {
            filename?: string | undefined;
            mime?: string | undefined;
        } | undefined;
    }, {
        type: "image" | "pdf" | "json" | "other";
        id: string;
        content_b64?: string | undefined;
        uri?: string | undefined;
        meta?: {
            filename?: string | undefined;
            mime?: string | undefined;
        } | undefined;
    }>, "many">>;
    structured: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    attachments: {
        type: "image" | "pdf" | "json" | "other";
        id: string;
        content_b64?: string | undefined;
        uri?: string | undefined;
        meta?: {
            filename?: string | undefined;
            mime?: string | undefined;
        } | undefined;
    }[];
    text?: string | undefined;
    structured?: Record<string, unknown> | undefined;
}, {
    text?: string | undefined;
    attachments?: {
        type: "image" | "pdf" | "json" | "other";
        id: string;
        content_b64?: string | undefined;
        uri?: string | undefined;
        meta?: {
            filename?: string | undefined;
            mime?: string | undefined;
        } | undefined;
    }[] | undefined;
    structured?: Record<string, unknown> | undefined;
}>;
declare const PreferencesSchema: z.ZodObject<{
    response_format: z.ZodDefault<z.ZodEnum<["text", "json", "markdown"]>>;
    verbosity: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
    stream: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    response_format: "json" | "text" | "markdown";
    verbosity: "low" | "medium" | "high";
    stream: boolean;
}, {
    response_format?: "json" | "text" | "markdown" | undefined;
    verbosity?: "low" | "medium" | "high" | undefined;
    stream?: boolean | undefined;
}>;
export declare const RequestEnvelopeSchema: z.ZodObject<{
    request_id: z.ZodString;
    caller: z.ZodObject<{
        app_id: z.ZodString;
        user_id: z.ZodString;
        org_id: z.ZodString;
        session_id: z.ZodOptional<z.ZodString>;
        scopes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        org_id: string;
        app_id: string;
        user_id: string;
        scopes: string[];
        session_id?: string | undefined;
    }, {
        org_id: string;
        app_id: string;
        user_id: string;
        session_id?: string | undefined;
        scopes?: string[] | undefined;
    }>;
    input: z.ZodDefault<z.ZodObject<{
        text: z.ZodOptional<z.ZodString>;
        attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<["image", "pdf", "json", "other"]>;
            content_b64: z.ZodOptional<z.ZodString>;
            uri: z.ZodOptional<z.ZodString>;
            meta: z.ZodOptional<z.ZodObject<{
                filename: z.ZodOptional<z.ZodString>;
                mime: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                filename?: string | undefined;
                mime?: string | undefined;
            }, {
                filename?: string | undefined;
                mime?: string | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            content_b64?: string | undefined;
            uri?: string | undefined;
            meta?: {
                filename?: string | undefined;
                mime?: string | undefined;
            } | undefined;
        }, {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            content_b64?: string | undefined;
            uri?: string | undefined;
            meta?: {
                filename?: string | undefined;
                mime?: string | undefined;
            } | undefined;
        }>, "many">>;
        structured: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        attachments: {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            content_b64?: string | undefined;
            uri?: string | undefined;
            meta?: {
                filename?: string | undefined;
                mime?: string | undefined;
            } | undefined;
        }[];
        text?: string | undefined;
        structured?: Record<string, unknown> | undefined;
    }, {
        text?: string | undefined;
        attachments?: {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            content_b64?: string | undefined;
            uri?: string | undefined;
            meta?: {
                filename?: string | undefined;
                mime?: string | undefined;
            } | undefined;
        }[] | undefined;
        structured?: Record<string, unknown> | undefined;
    }>>;
    preferences: z.ZodDefault<z.ZodObject<{
        response_format: z.ZodDefault<z.ZodEnum<["text", "json", "markdown"]>>;
        verbosity: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
        stream: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        response_format: "json" | "text" | "markdown";
        verbosity: "low" | "medium" | "high";
        stream: boolean;
    }, {
        response_format?: "json" | "text" | "markdown" | undefined;
        verbosity?: "low" | "medium" | "high" | undefined;
        stream?: boolean | undefined;
    }>>;
    /** Sync-only API: mode is optional but may only be "sync" when provided. */
    mode: z.ZodOptional<z.ZodLiteral<"sync">>;
    /** Wall-clock deadline in ms */
    deadline_ms: z.ZodOptional<z.ZodNumber>;
    /** Contract version for compatibility; only v1 supported (enforced at ingress) */
    contract_version: z.ZodDefault<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    request_id: string;
    caller: {
        org_id: string;
        app_id: string;
        user_id: string;
        scopes: string[];
        session_id?: string | undefined;
    };
    input: {
        attachments: {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            content_b64?: string | undefined;
            uri?: string | undefined;
            meta?: {
                filename?: string | undefined;
                mime?: string | undefined;
            } | undefined;
        }[];
        text?: string | undefined;
        structured?: Record<string, unknown> | undefined;
    };
    preferences: {
        response_format: "json" | "text" | "markdown";
        verbosity: "low" | "medium" | "high";
        stream: boolean;
    };
    contract_version: string;
    mode?: "sync" | undefined;
    deadline_ms?: number | undefined;
}, {
    request_id: string;
    caller: {
        org_id: string;
        app_id: string;
        user_id: string;
        session_id?: string | undefined;
        scopes?: string[] | undefined;
    };
    input?: {
        text?: string | undefined;
        attachments?: {
            type: "image" | "pdf" | "json" | "other";
            id: string;
            content_b64?: string | undefined;
            uri?: string | undefined;
            meta?: {
                filename?: string | undefined;
                mime?: string | undefined;
            } | undefined;
        }[] | undefined;
        structured?: Record<string, unknown> | undefined;
    } | undefined;
    preferences?: {
        response_format?: "json" | "text" | "markdown" | undefined;
        verbosity?: "low" | "medium" | "high" | undefined;
        stream?: boolean | undefined;
    } | undefined;
    mode?: "sync" | undefined;
    deadline_ms?: number | undefined;
    contract_version?: string | undefined;
}>;
export type RequestEnvelope = z.infer<typeof RequestEnvelopeSchema>;
export type Caller = z.infer<typeof CallerSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type RequestInput = z.infer<typeof InputSchema>;
export type RequestPreferences = z.infer<typeof PreferencesSchema>;
export {};
//# sourceMappingURL=request-envelope.d.ts.map