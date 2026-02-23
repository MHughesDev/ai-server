/**
 * ResponseEnvelope – external API contract for POST /v1/query response.
 * @see Docs/SPEC/02_API_Contracts.md, Docs/Architecture.md
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
}, "strip", z.ZodTypeAny, {
    citations: {
        source: string;
        ref: string;
        span?: string | undefined;
    }[];
    text?: string | undefined;
    structured?: Record<string, unknown> | undefined;
}, {
    text?: string | undefined;
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
}, "strip", z.ZodTypeAny, {
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
}, "strip", z.ZodTypeAny, {
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
    status: z.ZodEnum<["ok", "blocked", "error", "accepted"]>;
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
    }, "strip", z.ZodTypeAny, {
        citations: {
            source: string;
            ref: string;
            span?: string | undefined;
        }[];
        text?: string | undefined;
        structured?: Record<string, unknown> | undefined;
    }, {
        text?: string | undefined;
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
    }, "strip", z.ZodTypeAny, {
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
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        detail?: Record<string, unknown> | undefined;
    }, {
        code: string;
        message: string;
        detail?: Record<string, unknown> | undefined;
    }>>;
    /** For async mode */
    job_id: z.ZodOptional<z.ZodString>;
    /** Response mode */
    mode: z.ZodOptional<z.ZodEnum<["sync", "stream", "async"]>>;
}, "strip", z.ZodTypeAny, {
    status: "error" | "ok" | "blocked" | "accepted";
    request_id: string;
    error?: {
        code: string;
        message: string;
        detail?: Record<string, unknown> | undefined;
    } | undefined;
    mode?: "stream" | "sync" | "async" | undefined;
    output?: {
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
    job_id?: string | undefined;
}, {
    status: "error" | "ok" | "blocked" | "accepted";
    request_id: string;
    error?: {
        code: string;
        message: string;
        detail?: Record<string, unknown> | undefined;
    } | undefined;
    mode?: "stream" | "sync" | "async" | undefined;
    output?: {
        text?: string | undefined;
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
    job_id?: string | undefined;
}>;
export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type ResponseOutput = z.infer<typeof OutputSchema>;
export type Telemetry = z.infer<typeof TelemetrySchema>;
export type ResponseError = z.infer<typeof ErrorSchema>;
export {};
//# sourceMappingURL=response-envelope.d.ts.map