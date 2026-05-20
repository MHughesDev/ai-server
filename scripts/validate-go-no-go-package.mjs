#!/usr/bin/env node
/**
 * Validate go-no-go evidence package and signatories for a GO decision (PR-033).
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

async function main() {
  const path =
    process.env.GO_NO_GO_EVIDENCE_PACKAGE_PATH ??
    join(REPO_ROOT, "artifacts", "go-no-go-evidence-package.json");

  const { validateProductionGoNoGoDecision } = await import(
    "../dist/governance/go-no-go.js"
  );
  const raw = await readFile(path, "utf8");
  const pkg = JSON.parse(raw);

  const result = validateProductionGoNoGoDecision(pkg);
  if (!result.valid) {
    console.error("[go-no-go-validate] Failed:");
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(
    `[go-no-go-validate] OK outcome=${pkg.decision?.outcome ?? pkg.recommended_outcome} signatories=${pkg.signatories?.length ?? 0}`
  );
}

main().catch((err) => {
  console.error("[go-no-go-validate] Failed:", err);
  process.exit(1);
});
