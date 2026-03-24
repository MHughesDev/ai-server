/**
 * ResponseEnvelope – external API contract for POST /v1/query response.
 * @see docs/SPEC/02_API_Contracts.md, docs/ARCHITECTURE/Architecture_document_Finalized.md
 */
import { z } from "zod";
declare const CitationSchema: z.ZodObject<{
    source: z.ZodString;
    ref: z.ZodString;
    span: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: string;
    ref: string;
    span?: string | undefined;
}, {
    source: string;
    ref: string;
    span?: string | undefined;
}>;
/** Attachment reference in response output (M2 – Synthesis result_artifacts) */
declare const OutputAttachmentSchema: z.ZodObject<{
    artifact_uri: z.ZodOptional<z.ZodString>;
    artifact_id: z.ZodOptional<z.ZodString>;
    artifact_kind: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    artifact_uri?: string | undefined;
    artifact_id?: string | undefined;
    artifact_kind?: string | undefined;
}, {
    artifact_uri?: string | undefined;
    artifact_id?: string | undefined;
    artifact_kind?: string | undefined;
}>;
declare const OutputSchema: z.ZodObject<{
    text: z.ZodOptional<z.ZodString>;
    structured: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    citations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        source: z.ZodString;
        ref: z.ZodString;
        span: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        source: string;
        ref: string;
        span?: string | undefined;
    }, {
        source: string;
        ref: string;
        span?: string | undefined;
    }>, "many">>;
    /** M2: artifacts from Synthesis result_artifacts (artifact_uri, artifact_kind) */
    attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        artifact_uri: z.ZodOptional<z.ZodString>;
        artifact_id: z.ZodOptional<z.ZodString>;
        artifact_kind: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        artifact_uri?: string | undefined;
        artifact_id?: string | undefined;
        artifact_kind?: string | undefined;
    }, {
        artifact_uri?: string | undefined;
        artifact_id?: string | undefined;
        artifact_kind?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    attachments: {
        artifact_uri?: string | undefined;
        artifact_id?: string | undefined;
        artifact_kind?: string | undefined;
    }[];
    citations: {
        source: string;
        ref: string;
        span?: string | undefined;
    }[];
    text?: string | undefined;
    structured?: Record<string, unknown> | undefined;
}, {
    text?: string | undefined;
    attachments?: {
        artifact_uri?: string | undefined;
        artifact_id?: string | undefined;
        artifact_kind?: string | undefined;
    }[] | undefined;
    structured?: Record<string, unknown> | undefined;
    citations?: {
        source: string;
        ref: string;
        span?: string | undefined;
    }[] | undefined;
}>;
declare const TelemetrySchema: z.ZodObject<{
    pipeline: z.ZodOptional<z.ZodString>;
    models_used: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    tool_calls: z.ZodDefault<z.ZodNumber>;
    tokens_in: z.ZodDefault<z.ZodNumber>;
    tokens_out: z.ZodDefault<z.ZodNumber>;
    cost_usd_est: z.ZodDefault<z.ZodNumber>;
    latency_ms: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    models_used: string[];
    tool_calls: number;
    tokens_in: number;
    tokens_out: number;
    cost_usd_est: number;
    latency_ms: number;
    pipeline?: string | undefined;
}, {
    pipeline?: string | undefined;
    models_used?: string[] | undefined;
    tool_calls?: number | undefined;
    tokens_in?: number | undefined;
    tokens_out?: number | undefined;
    cost_usd_est?: number | undefined;
    latency_ms?: number | undefined;
}>;
declare const ErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    detail: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strict", z.ZodTypeAny, {
    code: string;
    message: string;
    detail?: Record<string, unknown> | undefined;
}, {
    code: string;
    message: string;
    detail?: Record<string, unknown> | undefined;
}>;
export declare const ResponseEnvelopeSchema: z.ZodObject<{
    request_id: z.ZodString;
    status: z.ZodEnum<["ok", "blocked", "error"]>;
    output: z.ZodOptional<z.ZodObject<{
        text: z.ZodOptional<z.ZodString>;
        structured: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        citations: z.ZodDefault<z.ZodArray<z.ZodObject<{
            source: z.ZodString;
            ref: z.ZodString;
            span: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            source: string;
            ref: string;
            span?: string | undefined;
        }, {
            source: string;
            ref: string;
            span?: string | undefined;
        }>, "many">>;
        /** M2: artifacts from Synthesis result_artifacts (artifact_uri, artifact_kind) */
        attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
            artifact_uri: z.ZodOptional<z.ZodString>;
            artifact_id: z.ZodOptional<z.ZodString>;
            artifact_kind: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            artifact_uri?: string | undefined;
            artifact_id?: string | undefined;
            artifact_kind?: string | undefined;
        }, {
            artifact_uri?: string | undefined;
            artifact_id?: string | undefined;
            artifact_kind?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        attachments: {
            artifact_uri?: string | undefined;
            artifact_id?: string | undefined;
            artifact_kind?: string | undefined;
        }[];
        citations: {
            source: string;
            ref: string;
            span?: string | undefined;
        }[];
        text?: string | undefined;
        structured?: Record<string, unknown> | undefined;
    }, {
        text?: string | undefined;
        attachments?: {
            artifact_uri?: string | undefined;
            artifact_id?: string | undefined;
            artifact_kind?: string | undefined;
        }[] | undefined;
        structured?: Record<string, unknown> | undefined;
        citations?: {
            source: string;
            ref: string;
            span?: string | undefined;
        }[] | undefined;
    }>>;
    telemetry: z.ZodOptional<z.ZodObject<{
        pipeline: z.ZodOptional<z.ZodString>;
        models_used: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        tool_calls: z.ZodDefault<z.ZodNumber>;
        tokens_in: z.ZodDefault<z.ZodNumber>;
        tokens_out: z.ZodDefault<z.ZodNumber>;
        cost_usd_est: z.ZodDefault<z.ZodNumber>;
        latency_ms: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        models_used: string[];
        tool_calls: number;
        tokens_in: number;
        tokens_out: number;
        cost_usd_est: number;
        latency_ms: number;
        pipeline?: string | undefined;
    }, {
        pipeline?: string | undefined;
        models_used?: string[] | undefined;
        tool_calls?: number | undefined;
        tokens_in?: number | undefined;
        tokens_out?: number | undefined;
        cost_usd_est?: number | undefined;
        latency_ms?: number | undefined;
    }>>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        detail: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strict", z.ZodTypeAny, {
        code: string;
        message: string;
        detail?: Record<string, unknown> | undefined;
    }, {
        code: string;
        message: string;
        detail?: Record<string, unknown> | undefined;
    }>>;
    /** Sync-only runtime: mode may only be "sync" when present. */
    mode: z.ZodOptional<z.ZodLiteral<"sync">>;
}, "strict", z.ZodTypeAny, {
    status: "error" | "ok" | "blocked";
    request_id: string;
    error?: {
        code: string;
        message: string;
        detail?: Record<string, unknown> | undefined;
    } | undefined;
    mode?: "sync" | undefined;
    output?: {
        attachments: {
            artifact_uri?: string | undefined;
            artifact_id?: string | undefined;
            artifact_kind?: string | undefined;
        }[];
        citations: {
            source: string;
            ref: string;
            span?: string | undefined;
        }[];
        text?: string | undefined;
        structured?: Record<string, unknown> | undefined;
    } | undefined;
    telemetry?: {
        models_used: string[];
        tool_calls: number;
        tokens_in: number;
        tokens_out: number;
        cost_usd_est: number;
        latency_ms: number;
        pipeline?: string | undefined;
    } | undefined;
}, {
    status: "error" | "ok" | "blocked";
    request_id: string;
    error?: {
        code: string;
        message: string;
        detail?: Record<string, unknown> | undefined;
    } | undefined;
    mode?: "sync" | undefined;
    output?: {
        text?: string | undefined;
        attachments?: {
            artifact_uri?: string | undefined;
            artifact_id?: string | undefined;
            artifact_kind?: string | undefined;
        }[] | undefined;
        structured?: Record<string, unknown> | undefined;
        citations?: {
            source: string;
            ref: string;
            span?: string | undefined;
        }[] | undefined;
    } | undefined;
    telemetry?: {
        pipeline?: string | undefined;
        models_used?: string[] | undefined;
        tool_calls?: number | undefined;
        tokens_in?: number | undefined;
        tokens_out?: number | undefined;
        cost_usd_est?: number | undefined;
        latency_ms?: number | undefined;
    } | undefined;
}>;
export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type ResponseOutput = z.infer<typeof OutputSchema>;
export type OutputAttachment = z.infer<typeof OutputAttachmentSchema>;
export type Telemetry = z.infer<typeof TelemetrySchema>;
export type ResponseError = z.infer<typeof ErrorSchema>;
export {};
//# sourceMappingURL=response-envelope.d.ts.map