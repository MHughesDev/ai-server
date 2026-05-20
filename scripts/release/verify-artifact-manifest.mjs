#!/usr/bin/env node
/**
 * Verify release-manifest.json checksums and HMAC signature (PR-030).
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const MANIFEST_PATH = join(REPO_ROOT, "artifacts", "release-manifest.json");

async function sha256File(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return hash.digest("hex");
}

function canonicalPayload(manifest) {
  const { signature: _sig, ...rest } = manifest;
  return JSON.stringify(rest);
}

async function main() {
  const key = process.env.RELEASE_SIGNING_KEY?.trim();
  if (!key) {
    console.error("[release-verify] RELEASE_SIGNING_KEY is required");
    process.exit(1);
  }

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  if (!manifest.signature?.value) {
    console.error("[release-verify] Manifest is not signed");
    process.exit(1);
  }

  const expected = createHmac("sha256", key).update(canonicalPayload(manifest), "utf8").digest("hex");
  const actual = manifest.signature.value;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(actual, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.error("[release-verify] Signature mismatch");
    process.exit(1);
  }

  for (const entry of manifest.artifacts ?? []) {
    const full = join(REPO_ROOT, entry.path);
    const digest = await sha256File(full);
    if (digest !== entry.sha256) {
      console.error(`[release-verify] Checksum mismatch: ${entry.path}`);
      process.exit(1);
    }
  }

  console.log(
    `[release-verify] OK (${manifest.artifacts?.length ?? 0} artifacts, release_id=${manifest.release_id})`
  );
}

main().catch((err) => {
  console.error("[release-verify] Failed:", err);
  process.exit(1);
});
