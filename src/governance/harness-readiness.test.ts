/**
 * L2-99 harness readiness decision tests (PR-034).
 */

import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assembleHarnessReadinessDecision,
  validateHarnessReadinessDecision,
  validateHarnessSignatoriesForGo,
  HARNESS_READINESS_SIGNATORY_ROLES,
  DEFAULT_HARNESS_EVIDENCE,
} from "./harness-readiness.js";

describe("harness readiness decision (PR-034)", () => {
  it("requires program_lead and security_lead for GO", () => {
    const r = validateHarnessSignatoriesForGo([
      { role: "program_lead", name: "PL", signed_at_iso: "2026-05-20T12:00:00.000Z" },
    ]);
    expect(r.valid).toBe(false);
    expect(r.missing_roles).toContain("security_lead");
  });

  it("assembles scorecard and recommends no_go when artifacts missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "hrg-"));
    await mkdir(join(root, "src/pipelines"), { recursive: true });
    await writeFile(join(root, "src/pipelines/coding-agent-pipeline.ts"), "//\n");
    await writeFile(join(root, "src/pipelines/coding-agent-pipeline.test.ts"), "//\n");

    const record = await assembleHarnessReadinessDecision({
      repoRoot: root,
      evidence: DEFAULT_HARNESS_EVIDENCE.filter(
        (e) => !e.link?.startsWith("artifacts/")
      ),
    });
    expect(record.scorecard).toBeDefined();
    expect(record.decision.outcome).toMatch(/no_go|pending/);
    expect(record.harness_enablement_approved).toBe(false);
  });

  it("approves harness enablement when GO, scorecard, artifacts, and signatories present", async () => {
    const root = process.cwd();
    const artifactsDir = join(root, "artifacts");
    await mkdir(artifactsDir, { recursive: true });
    for (const name of [
      "rollback-drill-evidence.json",
      "incident-drill-evidence.json",
      "go-no-go-evidence-package.json",
    ]) {
      await writeFile(join(artifactsDir, name), '{"passed":true}\n');
    }

    const signatories = HARNESS_READINESS_SIGNATORY_ROLES.map((role) => ({
      role,
      name: `Signer-${role}`,
      signed_at_iso: "2026-05-20T15:00:00.000Z",
    }));

    const record = await assembleHarnessReadinessDecision({
      repoRoot: root,
      signatories,
      decision: {
        outcome: "go",
        rationale:
          "All L2-99 dimensions evidenced; L2-08 drills and production go/no-go complete. Constrained pilot approved.",
        signatories: [...HARNESS_READINESS_SIGNATORY_ROLES],
      },
    });

    expect(record.evidence_validation.valid).toBe(true);
    expect(record.scorecard.passed).toBe(true);
    expect(record.decision.outcome).toBe("go");
    expect(record.harness_enablement_approved).toBe(true);
    expect(record.pilot_constraints?.require_allowlisted_tools).toBe(true);
    expect(validateHarnessReadinessDecision(record).valid).toBe(true);
  });
});
