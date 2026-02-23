/**
 * Governance types for L2-99 Harness Readiness Gate.
 * @see docs/PLANS/Implementation-plans/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md
 */
/** Readiness dimensions per L2-99 Section 2.1 */
export declare const READINESS_DIMENSIONS: readonly ["security", "policy_enforcement", "observability", "reliability", "operations", "governance"];
export type ReadinessDimension = (typeof READINESS_DIMENSIONS)[number];
/** Single category score (0–100) with optional weight for aggregation */
export interface CategoryScore {
    dimension: ReadinessDimension;
    score: number;
    weight: number;
    evidenceCount: number;
    passed: boolean;
}
/** Evidence item linked to a dimension; used for checklist and validation */
export interface EvidenceItem {
    id: string;
    dimension: ReadinessDimension;
    sourcePlan?: string;
    link?: string;
    collectedAtIso?: string;
    owner?: string;
    valid: boolean;
}
/** Risk register entry per L2-99 Section 2.2 */
export type RiskDisposition = "accepted" | "mitigated" | "rejected" | "open";
export interface RiskEntry {
    id: string;
    description: string;
    dimension: ReadinessDimension;
    disposition: RiskDisposition;
    owner?: string;
    dueDateIso?: string;
    notes?: string;
}
/** Readiness scorecard output per L2-99 Phase 2 */
export interface ReadinessScorecard {
    categoryScores: CategoryScore[];
    weightedTotal: number;
    evidenceCompletenessPercent: number;
    criticalGapsCount: number;
    passed: boolean;
    computedAtIso: string;
}
/** Decision outcome per L2-99 Phase 3 */
export type DecisionOutcome = "go" | "no_go" | "pending";
export interface DecisionMemo {
    outcome: DecisionOutcome;
    rationale: string;
    signedAtIso?: string;
    signatories?: string[];
    exceptionIds?: string[];
}
/** Exception with time-bound remediation */
export interface ExceptionRecord {
    id: string;
    criterionId: string;
    rationale: string;
    remediationDueIso: string;
    owner?: string;
}
/** Threshold config for scoring (frozen per Phase 0) */
export interface ScorecardThresholds {
    minWeightedTotal: number;
    maxCriticalGaps: number;
    minEvidenceCompletenessPercent: number;
    dimensionWeights: Partial<Record<ReadinessDimension, number>>;
}
//# sourceMappingURL=types.d.ts.map