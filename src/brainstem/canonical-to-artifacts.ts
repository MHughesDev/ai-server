/**
 * Convert CanonicalRequest to Typed Artifacts for engine consumption (M2).
 * @see Architecture §8.1, §8.4; SOW M2 – CanonicalRequest carries artifact_kind/schema_ref
 */

import type { CanonicalRequest } from "../contracts/canonical-request.js";
import type { TypedArtifact } from "../contracts/typed-artifact.js";
import { randomUUID } from "node:crypto";

/** Schema ref for user input text artifact */
export const SCHEMA_REF_USER_INPUT = "schema://user_input@v1";
/** Schema ref for attachment handle (ref-only) */
export const SCHEMA_REF_ATTACHMENT_HANDLE = "schema://attachment_handle@v1";

/**
 * Build Typed Artifacts from a CanonicalRequest for downstream engines.
 * - One "report" artifact for normalized text with artifact_kind and schema_ref.
 * - One artifact per attachment as ref-only (artifact_kind "document_chunk" or "custom", schema_ref).
 */
export function canonicalToTypedArtifacts(canonical: CanonicalRequest): TypedArtifact[] {
  const artifacts: TypedArtifact[] = [];
  const text = canonical.text?.trim() ?? "";
  if (text.length > 0) {
    artifacts.push({
      artifact_id: randomUUID(),
      artifact_kind: "report",
      schema_ref: SCHEMA_REF_USER_INPUT,
      encoding: "text",
      content: { inline: text },
      metadata: { provenance: "canonicalize" },
    });
  }
  for (const att of canonical.attachments ?? []) {
    artifacts.push({
      artifact_id: att.id,
      artifact_kind: "document_chunk",
      schema_ref: SCHEMA_REF_ATTACHMENT_HANDLE,
      encoding: "text",
      content: { ref: att.uri ?? att.id },
      metadata: { provenance: "canonicalize" },
    });
  }
  return artifacts;
}
