/**
 * Brain Stem – text canonicalization and input normalization.
 * @see docs/SPEC/05_BrainStem_Spec.md, L2-02 Phase 1, L2-07 Phase 1
 */

import type { RequestEnvelope } from "../contracts/request-envelope.js";
import type { CanonicalRequest } from "../contracts/canonical-request.js";
import type { CallerContext } from "../ingress/types.js";
import { preprocessAttachments } from "./preprocess.js";

/**
 * Build CanonicalRequest from validated RequestEnvelope.
 * Normalizes text (trim, single string), maps attachments to handles with token estimates, sets modalities.
 * Caller identity fields come from `callerContext` (ingress output): verified JWT claims when present, else envelope-derived (dev/eval).
 */
export function canonicalize(envelope: RequestEnvelope, callerContext: CallerContext): CanonicalRequest {
  const text = normalizeText(envelope.input?.text);
  const modalities = detectModalities(envelope);
  const rawAttachments = envelope.input?.attachments ?? [];
  const preprocessed = preprocessAttachments(rawAttachments);
  const attachments = rawAttachments.map((a, i) => ({
    id: a.id,
    type: a.type,
    uri: a.uri,
    mime: preprocessed[i]?.mime ?? a.meta?.mime,
    token_estimate: preprocessed[i]?.token_estimate,
  }));
  const token_estimate = estimateTokens(text, attachments);

  return {
    request_id: envelope.request_id,
    modalities,
    text,
    attachments,
    structured: envelope.input?.structured,
    token_estimate,
    caller_app_id: callerContext.appId,
    caller_user_id: callerContext.userId,
    caller_org_id: callerContext.orgId,
    session_id: callerContext.sessionId,
  };
}

function normalizeText(raw: string | undefined): string {
  if (raw == null || typeof raw !== "string") return "";
  return raw.trim();
}

function detectModalities(envelope: RequestEnvelope): ("text" | "image" | "file" | "structured")[] {
  const mods: Set<"text" | "image" | "file" | "structured"> = new Set();
  const text = envelope.input?.text?.trim();
  if (text && text.length > 0) mods.add("text");
  for (const a of envelope.input?.attachments ?? []) {
    if (a.type === "image") mods.add("image");
    else if (a.type === "pdf" || a.type === "json" || a.type === "other") mods.add("file");
  }
  if (envelope.input?.structured && Object.keys(envelope.input.structured).length > 0) {
    mods.add("structured");
  }
  return mods.size > 0 ? Array.from(mods) : ["text"];
}

function estimateTokens(
  text: string,
  attachments: { token_estimate?: number }[]
): number {
  const textTokens = Math.ceil(text.length / 4);
  const attachmentTokens = attachments.reduce(
    (sum, a) => sum + (a.token_estimate ?? 100),
    0
  );
  return Math.max(0, textTokens + attachmentTokens);
}
