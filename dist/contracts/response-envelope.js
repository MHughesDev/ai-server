/**
 * ResponseEnvelope – external API contract for POST /v1/query response.
 * @see Docs/SPEC/02_API_Contracts.md, Docs/Architecture.md
 */
import { z } from "zod";
const CitationSchema = z.object({
    source: z.string(),
    ref: z.string(),
    span: z.string().optional(),
});
const OutputSchema = z.object({
    text: z.string().optional(),
    structured: z.record(z.unknown()).optional(),
    citations: z.array(CitationSchema).default([]),
});
const TelemetrySchema = z.object({
    pipeline: z.string().optional(),
    models_used: z.array(z.string()).default([]),
    tool_calls: z.number().int().min(0).default(0),
    tokens_in: z.number().int().min(0).default(0),
    tokens_out: z.number().int().min(0).default(0),
    cost_usd_est: z.number().min(0).default(0),
    latency_ms: z.number().int().min(0).default(0),
});
const ErrorSchema = z.object({
    code: z.string(),
    message: z.string(),
    detail: z.record(z.unknown()).optional(),
});
export const ResponseEnvelopeSchema = z.object({
    request_id: z.string().uuid(),
    status: z.enum(["ok", "blocked", "error", "accepted"]),
    output: OutputSchema.optional(),
    telemetry: TelemetrySchema.optional(),
    error: ErrorSchema.optional(),
    /** For async mode */
    job_id: z.string().optional(),
    /** Response mode */
    mode: z.enum(["sync", "stream", "async"]).optional(),
});
//# sourceMappingURL=response-envelope.js.map