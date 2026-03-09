/**
 * ResponseEnvelope – external API contract for POST /v1/query response.
 * @see docs/SPEC/02_API_Contracts.md, docs/Architecture_document_Finalized.md
 */

import { z } from "zod";

const CitationSchema = z.object({
  source: z.string(),
  ref: z.string(),
  span: z.string().optional(),
});

/** Attachment reference in response output (M2 – Synthesis result_artifacts) */
const OutputAttachmentSchema = z.object({
  artifact_uri: z.string().optional(),
  artifact_id: z.string().optional(),
  artifact_kind: z.string().optional(),
});

const OutputSchema = z.object({
  text: z.string().optional(),
  structured: z.record(z.unknown()).optional(),
  citations: z.array(CitationSchema).default([]),
  /** M2: artifacts from Synthesis result_artifacts (artifact_uri, artifact_kind) */
  attachments: z.array(OutputAttachmentSchema).default([]),
});

const TelemetrySchema = z
  .object({
    pipeline: z.string().optional(),
    models_used: z.array(z.string()).default([]),
    tool_calls: z.number().int().min(0).default(0),
    tokens_in: z.number().int().min(0).default(0),
    tokens_out: z.number().int().min(0).default(0),
    cost_usd_est: z.number().min(0).default(0),
    latency_ms: z.number().int().min(0).default(0),
  })
  .strict();

const ErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    detail: z.record(z.unknown()).optional(),
  })
  .strict();

export const ResponseEnvelopeSchema = z
  .object({
    request_id: z.string().uuid(),
    status: z.enum(["ok", "blocked", "error"]),
    output: OutputSchema.optional(),
    telemetry: TelemetrySchema.optional(),
    error: ErrorSchema.optional(),
    /** Sync-only runtime: mode may only be "sync" when present. */
    mode: z.literal("sync").optional(),
  })
  .strict();

export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type ResponseOutput = z.infer<typeof OutputSchema>;
export type OutputAttachment = z.infer<typeof OutputAttachmentSchema>;
export type Telemetry = z.infer<typeof TelemetrySchema>;
export type ResponseError = z.infer<typeof ErrorSchema>;
