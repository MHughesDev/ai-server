/**
 * Evidence validation for L2-99 readiness gate (completeness and freshness).
 * @see docs/PLANS/implementation/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md Phase 1
 */
import { READINESS_DIMENSIONS } from "./types.js";
/** Default max age for evidence in days before considered stale */
const DEFAULT_STALE_DAYS = 30;
/**
 * Validate evidence set for completeness (all dimensions covered) and optional freshness.
 */
export function validateEvidence(evidence, options = {}) {
    const { maxStaleDays = DEFAULT_STALE_DAYS, requireAllDimensions = true } = options;
    const errors = [];
    const covered = new Set(evidence.filter((e) => e.valid).map((e) => e.dimension));
    const missingDimensions = requireAllDimensions
        ? READINESS_DIMENSIONS.filter((d) => !covered.has(d))
        : [];
    const completenessPercent = READINESS_DIMENSIONS.length > 0
        ? Math.round((covered.size / READINESS_DIMENSIONS.length) * 100)
        : 100;
    let staleCount = 0;
    const cutoff = Date.now() - maxStaleDays * 24 * 60 * 60 * 1000;
    for (const e of evidence) {
        if (!e.valid)
            continue;
        if (e.collectedAtIso) {
            const t = new Date(e.collectedAtIso).getTime();
            if (Number.isNaN(t))
                errors.push(`Evidence ${e.id}: invalid collectedAtIso`);
            else if (t < cutoff)
                staleCount++;
        }
    }
    if (missingDimensions.length > 0) {
        errors.push(`Missing evidence for dimensions: ${missingDimensions.join(", ")}`);
    }
    if (staleCount > 0) {
        errors.push(`${staleCount} evidence item(s) older than ${maxStaleDays} days`);
    }
    return {
        valid: errors.length === 0 && missingDimensions.length === 0,
        completenessPercent,
        missingDimensions,
        staleCount,
        errors,
    };
}
/**
 * Check that evidence coverage is at least the required percentage (e.g. 100%).
 */
export function isEvidenceComplete(evidence, requiredPercent = 100) {
    const result = validateEvidence(evidence, { requireAllDimensions: requiredPercent >= 100 });
    return result.completenessPercent >= requiredPercent && result.errors.length === 0;
}
//# sourceMappingURL=evidence.js.map