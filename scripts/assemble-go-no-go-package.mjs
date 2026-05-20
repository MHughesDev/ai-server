#!/usr/bin/env node
/**
 * Assemble production go/no-go evidence package (PR-033).
 * Optionally runs verify:sow when GO_NO_GO_RUN_VERIFY=true.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

async function main() {
  const runVerify = process.env.GO_NO_GO_RUN_VERIFY === "true";
  let verifySowPassed = false;

  if (runVerify) {
    console.log("[go-no-go] Running npm run verify:sow...");
    const result = spawnSync("npm", ["run", "verify:sow"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    verifySowPassed = result.status === 0;
    if (!verifySowPassed) {
      console.error("[go-no-go] verify:sow failed");
      process.exit(1);
    }
  }

  const { assembleProductionGoNoGoPackage, writeGoNoGoEvidencePackage, validateProductionGoNoGoDecision } =
    await import("../dist/governance/go-no-go.js");

  const pkg = await assembleProductionGoNoGoPackage({
    repoRoot: REPO_ROOT,
    verifySowPassed: runVerify ? true : verifySowPassed,
    releaseId: process.env.RELEASE_ID,
    buildId: process.env.BUILD_ID,
    gitSha: process.env.GITHUB_SHA,
  });

  const outPath =
    process.env.GO_NO_GO_EVIDENCE_PACKAGE_PATH ??
    join(REPO_ROOT, "artifacts", "go-no-go-evidence-package.json");
  await writeGoNoGoEvidencePackage(pkg, outPath);

  console.log(`[go-no-go] Wrote ${outPath}`);
  console.log(`[go-no-go] technical_passed=${pkg.technical_passed} recommended=${pkg.recommended_outcome}`);

  const validation = validateProductionGoNoGoDecision(pkg);
  if (pkg.decision?.outcome === "go" && !validation.valid) {
    console.error("[go-no-go] Decision validation failed:");
    for (const e of validation.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[go-no-go] Failed:", err);
  process.exit(1);
});
