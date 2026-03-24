/**
 * Governance module for L2-99 Harness Readiness Gate.
 * Scorecard calculation, evidence validation, and decision types.
 * @see docs/PLANS/implementation/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md
 */
export { READINESS_DIMENSIONS, } from "./types.js";
export { computeCategoryScore, computeScorecard, meetsWeightedThreshold, meetsEvidenceCompletenessThreshold, DEFAULT_THRESHOLDS, } from "./scorecard.js";
export { validateEvidence, isEvidenceComplete, } from "./evidence.js";
//# sourceMappingURL=index.js.map