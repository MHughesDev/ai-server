/**
 * Governance module for L2-99 Harness Readiness Gate.
 * Scorecard calculation, evidence validation, and decision types.
 * @see docs/PLANS/implementation/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md
 */

export {
  READINESS_DIMENSIONS,
  type CategoryScore,
  type DecisionMemo,
  type EvidenceItem,
  type ExceptionRecord,
  type ReadinessDimension,
  type ReadinessScorecard,
  type RiskEntry,
  type RiskDisposition,
  type ScorecardThresholds,
  type DecisionOutcome,
} from "./types.js";

export {
  computeCategoryScore,
  computeScorecard,
  meetsWeightedThreshold,
  meetsEvidenceCompletenessThreshold,
  DEFAULT_THRESHOLDS,
} from "./scorecard.js";

export {
  validateEvidence,
  isEvidenceComplete,
  type ValidationResult,
} from "./evidence.js";

export {
  REQUIRED_SIGNATORY_ROLES,
  assembleProductionGoNoGoPackage,
  validateSignatoriesForGo,
  validateProductionGoNoGoDecision,
  writeGoNoGoEvidencePackage,
  parseSignatoriesFromEnv,
  parseDecisionFromEnv,
  IN_REPO_EVIDENCE_LINKS,
  type SignatoryRecord,
  type ProductionGoNoGoEvidencePackage,
  type GoNoGoTechnicalGate,
} from "./go-no-go.js";
