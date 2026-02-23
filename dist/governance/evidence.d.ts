/**
 * Evidence validation for L2-99 readiness gate (completeness and freshness).
 * @see docs/PLANS/Implementation-plans/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md Phase 1
 */
import type { EvidenceItem, ReadinessDimension } from "./types.js";
export interface ValidationResult {
    valid: boolean;
    completenessPercent: number;
    missingDimensions: ReadinessDimension[];
    staleCount: number;
    errors: string[];
}
/**
 * Validate evidence set for completeness (all dimensions covered) and optional freshness.
 */
export declare function validateEvidence(evidence: EvidenceItem[], options?: {
    maxStaleDays?: number;
    requireAllDimensions?: boolean;
}): ValidationResult;
/**
 * Check that evidence coverage is at least the required percentage (e.g. 100%).
 */
export declare function isEvidenceComplete(evidence: EvidenceItem[], requiredPercent?: number): boolean;
//# sourceMappingURL=evidence.d.ts.map