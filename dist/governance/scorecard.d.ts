/**
 * Readiness scorecard calculator and threshold logic (L2-99).
 * @see docs/PLANS/Implementation-plans/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md Section 7.1
 */
import type { CategoryScore, EvidenceItem, ReadinessDimension, ReadinessScorecard, RiskEntry, ScorecardThresholds } from "./types.js";
/** Default thresholds per L2-99 constraints (critical security, evidence completeness) */
export declare const DEFAULT_THRESHOLDS: ScorecardThresholds;
/**
 * Compute category score for one dimension from evidence (0–100).
 * Score = (valid evidence count / required slots) * 100, capped at 100.
 */
export declare function computeCategoryScore(dimension: ReadinessDimension, evidence: EvidenceItem[], weight: number): CategoryScore;
/**
 * Compute full readiness scorecard with weighted total and pass/fail.
 */
export declare function computeScorecard(evidence: EvidenceItem[], risks: RiskEntry[], thresholds?: ScorecardThresholds): ReadinessScorecard;
/**
 * Check if weighted total meets the minimum threshold.
 */
export declare function meetsWeightedThreshold(weightedTotal: number, thresholds?: ScorecardThresholds): boolean;
/**
 * Check if evidence completeness meets the minimum threshold.
 */
export declare function meetsEvidenceCompletenessThreshold(evidenceCompletenessPercent: number, thresholds?: ScorecardThresholds): boolean;
//# sourceMappingURL=scorecard.d.ts.map