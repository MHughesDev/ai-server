#!/usr/bin/env node
/**
 * Build a traceable release manifest with SHA-256 checksums for dist/ artifacts (PR-030).
 * @see docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const DIST_DIR = join(REPO_ROOT, "dist");
const OUT_DIR = join(REPO_ROOT, "artifacts");
const MANIFEST_PATH = join(OUT_DIR, "release-manifest.json");

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

async function walkDist(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDist(full, base)));
    } else if (entry.isFile()) {
      files.push(relative(base, full).replace(/\\/g, "/"));
    }
  }
  return files.sort();
}

function resolveGitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync("git rev-parse HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  let pkgVersion = "0.0.0";
  try {
    const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf8"));
    pkgVersion = pkg.version ?? pkgVersion;
  } catch {
    // ignore
  }

  const relFiles = await walkDist(DIST_DIR);
  if (relFiles.length === 0) {
    console.error("[release-manifest] dist/ is empty; run npm run build first");
    process.exit(1);
  }

  const artifacts = [];
  for (const rel of relFiles) {
    const full = join(DIST_DIR, rel);
    const digest = await sha256File(full);
    artifacts.push({ path: `dist/${rel}`, sha256: digest });
  }

  const manifest = {
    schema_version: "1",
    generated_at: new Date().toISOString(),
    package_version: pkgVersion,
    release_id: process.env.RELEASE_ID ?? process.env.GITHUB_SHA ?? resolveGitSha(),
    build_id: process.env.BUILD_ID ?? process.env.GITHUB_RUN_ID ?? "local",
    git_sha: resolveGitSha(),
    node_version: process.version,
    artifacts,
    signature: null,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[release-manifest] Wrote ${MANIFEST_PATH} (${artifacts.length} files)`);
}

main().catch((err) => {
  console.error("[release-manifest] Failed:", err);
  process.exit(1);
});
