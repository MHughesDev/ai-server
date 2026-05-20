#!/usr/bin/env node
/**
 * HMAC-SHA256 sign release-manifest.json for traceability (PR-030).
 * Set RELEASE_SIGNING_KEY in CI (secret) or workflow attestation binding.
 */

import { createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const MANIFEST_PATH = join(REPO_ROOT, "artifacts", "release-manifest.json");

function canonicalPayload(manifest) {
  const { signature: _sig, ...rest } = manifest;
  return JSON.stringify(rest);
}

async function main() {
  const key = process.env.RELEASE_SIGNING_KEY?.trim();
  if (!key) {
    console.error(
      "[release-sign] RELEASE_SIGNING_KEY is required (set a repo secret or CI attestation key)"
    );
    process.exit(1);
  }

  const raw = await readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(raw);
  const payload = canonicalPayload(manifest);
  const signature = createHmac("sha256", key).update(payload, "utf8").digest("hex");

  manifest.signature = {
    algorithm: "HMAC-SHA256",
    value: signature,
    signed_at: new Date().toISOString(),
  };

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log("[release-sign] Manifest signed");
}

main().catch((err) => {
  console.error("[release-sign] Failed:", err);
  process.exit(1);
});
