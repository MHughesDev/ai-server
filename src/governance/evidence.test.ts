/**
 * Unit tests for evidence validation (L2-99 Phase 1).
 */

import { validateEvidence, isEvidenceComplete } from "./evidence.js";
import type { EvidenceItem } from "./types.js";

function ev(
  id: string,
  dimension: EvidenceItem["dimension"],
  valid = true,
  collectedAtIso?: string
): EvidenceItem {
  return {
    id,
    dimension,
    valid,
    collectedAtIso: collectedAtIso ?? new Date().toISOString(),
  };
}

describe("validateEvidence", () => {
  it("passes when all dimensions have valid evidence", () => {
    const evidence: EvidenceItem[] = [
      ev("1", "security"),
      ev("2", "policy_enforcement"),
      ev("3", "observability"),
      ev("4", "reliability"),
      ev("5", "operations"),
      ev("6", "governance"),
    ];
    const result = validateEvidence(evidence);
    expect(result.valid).toBe(true);
    expect(result.completenessPercent).toBe(100);
    expect(result.missingDimensions).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("reports missing dimensions", () => {
    const evidence: EvidenceItem[] = [ev("1", "security"), ev("2", "observability")];
    const result = validateEvidence(evidence);
    expect(result.valid).toBe(false);
    expect(result.missingDimensions.length).toBeGreaterThan(0);
    expect(result.completenessPercent).toBeLessThan(100);
    expect(result.errors.some((e) => e.includes("Missing evidence"))).toBe(true);
  });

  it("counts stale evidence when older than maxStaleDays", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 45);
    const evidence: EvidenceItem[] = [
      ev("1", "security"),
      ev("2", "policy_enforcement", true, oldDate.toISOString()),
    ];
    const result = validateEvidence(evidence, { maxStaleDays: 30 });
    expect(result.staleCount).toBe(1);
    expect(result.errors.some((e) => e.includes("older than"))).toBe(true);
  });
});

describe("isEvidenceComplete", () => {
  it("returns true when coverage meets required percent", () => {
    const evidence: EvidenceItem[] = [
      ev("1", "security"),
      ev("2", "policy_enforcement"),
      ev("3", "observability"),
      ev("4", "reliability"),
      ev("5", "operations"),
      ev("6", "governance"),
    ];
    expect(isEvidenceComplete(evidence, 100)).toBe(true);
  });

  it("returns false when dimensions missing", () => {
    const evidence: EvidenceItem[] = [ev("1", "security")];
    expect(isEvidenceComplete(evidence, 100)).toBe(false);
  });
});
