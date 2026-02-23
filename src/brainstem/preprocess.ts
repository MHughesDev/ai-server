/**
 * Multimodal preprocessing – deterministic metadata and token estimates (L2-07 Phase 1).
 * @see Docs/SPEC/05_BrainStem_Spec.md
 */

import type { Attachment } from "../contracts/request-envelope.js";

export interface PreprocessResult {
  token_estimate: number;
  mime?: string;
}

/** Default token estimates by type (deterministic for budgeting) */
const DEFAULT_TOKEN_ESTIMATES: Record<Attachment["type"], number> = {
  image: 256,
  pdf: 512,
  json: 128,
  other: 256,
};

/**
 * Preprocess a single attachment: normalize mime and compute token estimate.
 * Deterministic: no I/O, same input yields same output.
 */
export function preprocessAttachment(attachment: Attachment): PreprocessResult {
  const mime = attachment.meta?.mime?.toLowerCase().trim();
  let token_estimate = DEFAULT_TOKEN_ESTIMATES[attachment.type];
  if (attachment.type === "json" && attachment.content_b64) {
    try {
      const decodedLen = Math.ceil((attachment.content_b64.length * 3) / 4);
      token_estimate = Math.min(4096, Math.max(128, Math.ceil(decodedLen / 4)));
    } catch {
      // keep default
    }
  }
  return { token_estimate, mime };
}

/**
 * Preprocess all attachments; returns array of results in same order.
 */
export function preprocessAttachments(attachments: Attachment[]): PreprocessResult[] {
  return attachments.map(preprocessAttachment);
}
