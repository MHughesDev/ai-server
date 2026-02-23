/**
 * Integration-style test: evidence validation + scorecard workflow (L2-99 Section 7.2).
 * Covers path from evidence set → validate → score → pass/fail.
 */

import { validateEvidence, isEvidenceComplete } from "./evidence.js";
import { computeScorecard, DEFAULT_THRESHOLDS } from "./scorecard.js";
import type { EvidenceItem, RiskEntry } from "./types.js";

function ev(
  id: string,
  dimension: EvidenceItem["dimension"],
  valid = true
): EvidenceItem {
  return {
    id,
    dimension,
    valid,
    collectedAtIso: new Date().toISOString(),
  };
}

describe("Readiness workflow (evidence → validate → score)", () => {
  it("full workflow: complete evidence and no risks yields passed scorecard", () => {
    const evidence: EvidenceItem[] = [
      ev("1", "security"),
      ev("2", "policy_enforcement"),
      ev("3", "observability"),
      ev("4", "reliability"),
      ev("5", "operations"),
      ev("6", "governance"),
    ];
    const validation = validateEvidence(evidence);
    expect(validation.valid).toBe(true);
    expect(isEvidenceComplete(evidence, 100)).toBe(true);

    const risks: RiskEntry[] = [];
    const scorecard = computeScorecard(evidence, risks, DEFAULT_THRESHOLDS);
    expect(scorecard.evidenceCompletenessPercent).toBe(100);
    expect(scorecard.criticalGapsCount).toBe(0);
    expect(scorecard.passed).toBe(true);
    expect(scorecard.weightedTotal).toBeGreaterThanOrEqual(
      DEFAULT_THRESHOLDS.minWeightedTotal
    );
  });

  it("workflow: missing evidence dimension fails validation and scorecard fails when gaps present", () => {
    const evidence: EvidenceItem[] = [
      ev("1", "security"),
      ev("2", "observability"),
    ];
    const validation = validateEvidence(evidence);
    expect(validation.valid).toBe(false);
    expect(validation.missingDimensions.length).toBeGreaterThan(0);
    expect(isEvidenceComplete(evidence, 100)).toBe(false);

    const risks: RiskEntry[] = [
      { id: "r1", description: "Open risk", dimension: "security", disposition: "open" },
    ];
    const scorecard = computeScorecard(evidence, risks, DEFAULT_THRESHOLDS);
    expect(scorecard.passed).toBe(false);
  });
});
