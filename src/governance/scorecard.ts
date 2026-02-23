/**
 * Readiness scorecard calculator and threshold logic (L2-99).
 * @see docs/PLANS/Implementation-plans/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md Section 7.1
 */

import type {
  CategoryScore,
  EvidenceItem,
  ReadinessDimension,
  ReadinessScorecard,
  RiskEntry,
  ScorecardThresholds,
} from "./types.js";
import { READINESS_DIMENSIONS } from "./types.js";

const DEFAULT_WEIGHTS: Record<ReadinessDimension, number> = {
  security: 0.25,
  policy_enforcement: 0.15,
  observability: 0.15,
  reliability: 0.15,
  operations: 0.15,
  governance: 0.15,
};

/** Default thresholds per L2-99 constraints (critical security, evidence completeness) */
export const DEFAULT_THRESHOLDS: ScorecardThresholds = {
  minWeightedTotal: 70,
  maxCriticalGaps: 0,
  minEvidenceCompletenessPercent: 100,
  dimensionWeights: DEFAULT_WEIGHTS,
};

/**
 * Compute category score for one dimension from evidence (0–100).
 * Score = (valid evidence count / required slots) * 100, capped at 100.
 */
export function computeCategoryScore(
  dimension: ReadinessDimension,
  evidence: EvidenceItem[],
  weight: number
): CategoryScore {
  const dimEvidence = evidence.filter((e) => e.dimension === dimension);
  const validCount = dimEvidence.filter((e) => e.valid).length;
  const totalSlots = Math.max(dimEvidence.length, 1);
  const score = Math.min(100, Math.round((validCount / totalSlots) * 100));
  const passed = score >= 100 || (totalSlots > 0 && validCount === dimEvidence.length);
  return {
    dimension,
    score,
    weight,
    evidenceCount: validCount,
    passed,
  };
}

/**
 * Compute full readiness scorecard with weighted total and pass/fail.
 */
export function computeScorecard(
  evidence: EvidenceItem[],
  risks: RiskEntry[],
  thresholds: ScorecardThresholds = DEFAULT_THRESHOLDS
): ReadinessScorecard {
  const weights = { ...DEFAULT_WEIGHTS, ...thresholds.dimensionWeights };
  const categoryScores: CategoryScore[] = READINESS_DIMENSIONS.map((dim) =>
    computeCategoryScore(dim, evidence, weights[dim] ?? 0.15)
  );

  let weightedTotal = 0;
  let totalWeight = 0;
  for (const cs of categoryScores) {
    weightedTotal += cs.score * cs.weight;
    totalWeight += cs.weight;
  }
  weightedTotal = totalWeight > 0 ? Math.round((weightedTotal / totalWeight) * 100) / 100 : 0;

  const requiredEvidenceCount = READINESS_DIMENSIONS.length;
  const dimensionsWithEvidence = new Set(evidence.filter((e) => e.valid).map((e) => e.dimension))
    .size;
  const evidenceCompletenessPercent =
    requiredEvidenceCount > 0
      ? Math.min(100, Math.round((dimensionsWithEvidence / requiredEvidenceCount) * 100))
      : 0;

  const criticalGapsCount = risks.filter(
    (r) => r.disposition === "open" && r.dimension === "security"
  ).length;
  const openGaps = risks.filter((r) => r.disposition === "open").length;

  const passed =
    weightedTotal >= thresholds.minWeightedTotal &&
    criticalGapsCount <= thresholds.maxCriticalGaps &&
    evidenceCompletenessPercent >= thresholds.minEvidenceCompletenessPercent &&
    openGaps <= thresholds.maxCriticalGaps;

  return {
    categoryScores,
    weightedTotal,
    evidenceCompletenessPercent,
    criticalGapsCount: Math.max(criticalGapsCount, openGaps),
    passed,
    computedAtIso: new Date().toISOString(),
  };
}

/**
 * Check if weighted total meets the minimum threshold.
 */
export function meetsWeightedThreshold(
  weightedTotal: number,
  thresholds: ScorecardThresholds = DEFAULT_THRESHOLDS
): boolean {
  return weightedTotal >= thresholds.minWeightedTotal;
}

/**
 * Check if evidence completeness meets the minimum threshold.
 */
export function meetsEvidenceCompletenessThreshold(
  evidenceCompletenessPercent: number,
  thresholds: ScorecardThresholds = DEFAULT_THRESHOLDS
): boolean {
  return evidenceCompletenessPercent >= thresholds.minEvidenceCompletenessPercent;
}
