/**
 * Unit tests for readiness scorecard and threshold logic (L2-99 Section 7.1).
 */

import {
  computeCategoryScore,
  computeScorecard,
  meetsWeightedThreshold,
  meetsEvidenceCompletenessThreshold,
  DEFAULT_THRESHOLDS,
} from "./scorecard.js";
import type { EvidenceItem, RiskEntry, ScorecardThresholds } from "./types.js";

function evidence(dimension: EvidenceItem["dimension"], valid = true): EvidenceItem {
  return {
    id: `ev-${dimension}`,
    dimension,
    valid,
    collectedAtIso: new Date().toISOString(),
  };
}

describe("computeCategoryScore", () => {
  it("returns 100 when all evidence valid", () => {
    const score = computeCategoryScore(
      "security",
      [evidence("security"), evidence("security")],
      0.25
    );
    expect(score.score).toBe(100);
    expect(score.passed).toBe(true);
    expect(score.evidenceCount).toBe(2);
  });

  it("returns 0 when no valid evidence", () => {
    const score = computeCategoryScore("security", [evidence("security", false)], 0.25);
    expect(score.score).toBe(0);
    expect(score.passed).toBe(false);
  });

  it("returns proportional score for partial validity", () => {
    const score = computeCategoryScore(
      "observability",
      [evidence("observability"), evidence("observability", false)],
      0.15
    );
    expect(score.score).toBe(50);
  });
});

describe("computeScorecard", () => {
  it("produces weighted total and pass when evidence complete and no open risks", () => {
    const allEvidence: EvidenceItem[] = [
      evidence("security"),
      evidence("policy_enforcement"),
      evidence("observability"),
      evidence("reliability"),
      evidence("operations"),
      evidence("governance"),
    ];
    const risks: RiskEntry[] = [];
    const card = computeScorecard(allEvidence, risks);
    expect(card.weightedTotal).toBeGreaterThanOrEqual(0);
    expect(card.evidenceCompletenessPercent).toBe(100);
    expect(card.criticalGapsCount).toBe(0);
    expect(card.passed).toBe(true);
    expect(card.categoryScores).toHaveLength(6);
  });

  it("fails when critical security gaps exist", () => {
    const allEvidence: EvidenceItem[] = [
      evidence("security"),
      evidence("policy_enforcement"),
      evidence("observability"),
      evidence("reliability"),
      evidence("operations"),
      evidence("governance"),
    ];
    const risks: RiskEntry[] = [
      { id: "r1", description: "Critical", dimension: "security", disposition: "open" },
    ];
    const card = computeScorecard(allEvidence, risks);
    expect(card.passed).toBe(false);
    expect(card.criticalGapsCount).toBeGreaterThanOrEqual(1);
  });

  it("respects custom thresholds", () => {
    const strict: ScorecardThresholds = {
      ...DEFAULT_THRESHOLDS,
      minWeightedTotal: 95,
    };
    const allEvidence: EvidenceItem[] = [
      evidence("security"),
      evidence("policy_enforcement"),
      evidence("observability"),
      evidence("reliability"),
      evidence("operations"),
      evidence("governance"),
    ];
    const card = computeScorecard(allEvidence, [], strict);
    expect(card.weightedTotal).toBeLessThanOrEqual(100);
    if (card.weightedTotal < 95) expect(card.passed).toBe(false);
  });
});

describe("meetsWeightedThreshold", () => {
  it("returns true when at or above min", () => {
    expect(meetsWeightedThreshold(70)).toBe(true);
    expect(meetsWeightedThreshold(70, { ...DEFAULT_THRESHOLDS, minWeightedTotal: 70 })).toBe(true);
  });

  it("returns false when below min", () => {
    expect(meetsWeightedThreshold(69, { ...DEFAULT_THRESHOLDS, minWeightedTotal: 70 })).toBe(false);
  });
});

describe("meetsEvidenceCompletenessThreshold", () => {
  it("returns true when at or above min", () => {
    expect(meetsEvidenceCompletenessThreshold(100)).toBe(true);
  });

  it("returns false when below min", () => {
    expect(
      meetsEvidenceCompletenessThreshold(99, {
        ...DEFAULT_THRESHOLDS,
        minEvidenceCompletenessPercent: 100,
      })
    ).toBe(false);
  });
});
