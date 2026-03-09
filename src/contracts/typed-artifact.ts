/**
 * Typed Artifact – universal envelope for engine I/O.
 * @see Architecture §8.4
 */

import { z } from "zod";

export const ArtifactContentSchema = z.object({
  inline: z.unknown().optional(),
  ref: z.string().optional(),
});
export type ArtifactContent = z.infer<typeof ArtifactContentSchema>;

export const ArtifactMetadataSchema = z.object({
  created_by: z.string().optional(),
  provenance: z.string().optional(),
  trust_score: z.number().min(0).max(1).optional(),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
});
export type ArtifactMetadata = z.infer<typeof ArtifactMetadataSchema>;

export const ARTIFACT_KINDS = [
  "workflow_plan",
  "evaluation_report",
  "tool_result",
  "memory_response",
  "code_patch",
  "report",
  "diff",
  "document_chunk",
  "research_report",
  "decision_memo",
  "normalized_record",
  "classification_result",
  "custom",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const TypedArtifactSchema = z.object({
  artifact_id: z.string(),
  artifact_kind: z.enum(ARTIFACT_KINDS),
  schema_ref: z.string().optional(),
  encoding: z.enum(["json", "text", "binary"]).default("json"),
  content: ArtifactContentSchema,
  metadata: ArtifactMetadataSchema.optional(),
});
export type TypedArtifact = z.infer<typeof TypedArtifactSchema>;
