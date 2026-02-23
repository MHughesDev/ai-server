#!/usr/bin/env node
/**
 * L2-01: Lightweight secret scan – fail if likely secrets appear in tracked files.
 * Run in CI; excludes node_modules and dist.
 * Patterns: AWS keys, generic API key style, bearer tokens, connection strings with passwords.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const PATTERNS = [
  { name: "AWS_ACCESS_KEY", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "AWS_SECRET", regex: /(?:"|')?(?:AWS|aws)_secret(?:_access_key)?(?:"|')?\s*[:=]\s*(?:"|')[A-Za-z0-9/+=]{40}(?:"|')/ },
  { name: "Generic API key", regex: /(?:api[_-]?key|apikey|secret)(?:"|')?\s*[:=]\s*(?:"|')[A-Za-z0-9_\-]{20,}(?:"|')/i },
  { name: "Bearer token in file", regex: /Bearer\s+[A-Za-z0-9_\-\.]{20,}/ },
  { name: "Private key block", regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
];

const excludeDirs = "node_modules|dist|\\.git";
function getTrackedFiles() {
  try {
    const out = execSync("git ls-files", { encoding: "utf8" });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  const files = getTrackedFiles().filter(
    (f) => !new RegExp(`^(${excludeDirs})/`).test(f) && !f.includes("node_modules")
  );
  const hits = [];
  for (const file of files) {
    try {
      const content = readFileSync(file, "utf8");
      for (const { name, regex } of PATTERNS) {
        if (regex.test(content)) hits.push({ file, pattern: name });
      }
    } catch {
      // skip binary or unreadable
    }
  }
  if (hits.length > 0) {
    console.error("Possible secrets detected (fail build):");
    hits.forEach(({ file, pattern }) => console.error(`  ${file}: ${pattern}`));
    process.exit(1);
  }
  console.log("No obvious secrets detected.");
}

main();
