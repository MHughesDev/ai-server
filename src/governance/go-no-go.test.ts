/**
 * Go/no-go evidence package and signatory tests (PR-033).
 */

import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assembleProductionGoNoGoPackage,
  parseSignatoriesFromEnv,
  validateProductionGoNoGoDecision,
  validateSignatoriesForGo,
  REQUIRED_SIGNATORY_ROLES,
} from "./go-no-go.js";

describe("go/no-go signatories (PR-033)", () => {
  it("requires all mandatory roles for GO", () => {
    const partial = [
      { role: "engineering_lead", name: "Eng", signed_at_iso: "2026-05-20T12:00:00.000Z" },
    ];
    const result = validateSignatoriesForGo(partial);
    expect(result.valid).toBe(false);
    expect(result.missing_roles).toEqual(
      expect.arrayContaining(["security_risk", "operations_sre"])
    );
  });

  it("accepts complete signatory set", () => {
    const full = REQUIRED_SIGNATORY_ROLES.map((role) => ({
      role,
      name: `Signer-${role}`,
      signed_at_iso: "2026-05-20T12:00:00.000Z",
    }));
    expect(validateSignatoriesForGo(full).valid).toBe(true);
  });

  it("parses signatories from JSON env shape", () => {
    const json = JSON.stringify([
      { role: "engineering_lead", name: "A", signed_at_iso: "2026-05-20T00:00:00.000Z" },
    ]);
    expect(parseSignatoriesFromEnv(json)).toHaveLength(1);
  });
});

describe("assembleProductionGoNoGoPackage", () => {
  it("marks technical_passed when verify and artifacts are present", async () => {
    const root = await mkdtemp(join(tmpdir(), "go-no-go-"));
    await mkdir(join(root, "src/server"), { recursive: true });
    await mkdir(join(root, ".github/workflows"), { recursive: true });
    await mkdir(join(root, "artifacts"), { recursive: true });
    await writeFile(join(root, "openapi.yaml"), "paths:\n");
    await writeFile(join(root, "src/server/routes.ts"), "path === ");
    await writeFile(join(root, ".github/workflows/ci.yml"), "name: CI\n");
    await writeFile(
      join(root, "artifacts/rollback-drill-evidence.json"),
      '{"passed":true}\n'
    );
    await writeFile(
      join(root, "artifacts/incident-drill-evidence.json"),
      '{"passed":true}\n'
    );

    const pkg = await assembleProductionGoNoGoPackage({
      repoRoot: root,
      verifySowPassed: true,
      signatories: REQUIRED_SIGNATORY_ROLES.map((role) => ({
        role,
        name: "Test",
        signed_at_iso: "2026-05-20T12:00:00.000Z",
      })),
      decision: {
        outcome: "go",
        rationale: "All automated gates and drills passed in CI.",
        signatories: ["engineering_lead", "security_risk", "operations_sre"],
      },
    });

    expect(pkg.technical_passed).toBe(true);
    expect(pkg.recommended_outcome).toBe("go");
    expect(validateProductionGoNoGoDecision(pkg).valid).toBe(true);
  });

  it("recommends no_go when verify:sow not confirmed", async () => {
    const root = await mkdtemp(join(tmpdir(), "go-no-go-fail-"));
    await mkdir(join(root, "src/server"), { recursive: true });
    await mkdir(join(root, ".github/workflows"), { recursive: true });
    await writeFile(join(root, "openapi.yaml"), "paths:\n");
    await writeFile(join(root, "src/server/routes.ts"), "x");
    await writeFile(join(root, ".github/workflows/ci.yml"), "name: CI\n");

    const pkg = await assembleProductionGoNoGoPackage({
      repoRoot: root,
      verifySowPassed: false,
    });
    expect(pkg.technical_passed).toBe(false);
    expect(pkg.recommended_outcome).toBe("no_go");
    expect(validateProductionGoNoGoDecision(pkg).valid).toBe(false);
  });
});
