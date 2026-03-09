/**
 * M5 workflow artifacts – ResearchReport and DecisionMemo content shapes.
 * @see Architecture §11.3 (Deep Research), §11.5 (Decision & Recommendation)
 */

import { z } from "zod";

/** Evidence link for a claim (ResearchReport) */
export const EvidenceLinkSchema = z.object({
  source: z.string(),
  ref: z.string().optional(),
  span: z.string().optional(),
});
export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;

/** Single claim with evidence (ResearchReport) */
export const ClaimSchema = z.object({
  claim_id: z.string().optional(),
  statement: z.string(),
  evidence_links: z.array(EvidenceLinkSchema).default([]),
  confidence: z.number().min(0).max(1).optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

/** ResearchReport artifact content (claims, evidence, open questions) */
export const ResearchReportContentSchema = z.object({
  summary: z.string().optional(),
  claims: z.array(ClaimSchema).default([]),
  open_questions: z.array(z.string()).default([]),
  coverage_note: z.string().optional(),
});
export type ResearchReportContent = z.infer<typeof ResearchReportContentSchema>;

/** Single option (DecisionMemo) */
export const OptionSchema = z.object({
  option_id: z.string().optional(),
  label: z.string(),
  description: z.string().optional(),
  score: z.number().optional(),
});
export type Option = z.infer<typeof OptionSchema>;

/** DecisionMemo artifact content (options, scores, recommendation) */
export const DecisionMemoContentSchema = z.object({
  question: z.string().optional(),
  options: z.array(OptionSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  recommendation: z.string().optional(),
  recommendation_option_id: z.string().optional(),
});
export type DecisionMemoContent = z.infer<typeof DecisionMemoContentSchema>;
