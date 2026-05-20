#!/usr/bin/env node
/**
 * Ensure openapi.yaml paths match route handling in src/server/routes.ts (PR-030).
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const ROUTES_LITERALS = [
  "/healthz",
  "/readyz",
  "/metrics",
  "/v1/version",
  "/v1/preflight",
  "/token/exchange",
  "/v1/query",
  "/v1/query/async",
  "/v1/jobs",
  "/admin/flags",
  "/admin/flags/evaluate",
  "/admin/flags/overrides",
];

function extractOpenApiPaths(yaml) {
  const paths = [];
  const re = /^ {2}(\/[^\s:]+):\s*$/gm;
  let m;
  while ((m = re.exec(yaml)) !== null) {
    paths.push(m[1]);
  }
  return paths;
}

function pathCoveredInRoutes(path, routesSource) {
  if (routesSource.includes(`path === "${path}"`)) return true;
  if (path.startsWith("/v1/jobs") && routesSource.includes('path.startsWith("/v1/jobs/")')) {
    return true;
  }
  if (path.startsWith("/admin/flags") && routesSource.includes('path.startsWith("/admin/flags")')) {
    return true;
  }
  return false;
}

function openApiCoversLiteral(literal, openApiPaths) {
  if (openApiPaths.includes(literal)) return true;
  if (literal === "/v1/jobs") {
    return openApiPaths.some((p) => p === "/v1/jobs" || p.startsWith("/v1/jobs/"));
  }
  if (literal.startsWith("/admin/flags")) {
    return openApiPaths.some((p) => p === literal || p.startsWith(`${literal}/`));
  }
  return false;
}

async function main() {
  const routesSource = await readFile(join(REPO_ROOT, "src/server/routes.ts"), "utf8");
  const openApi = await readFile(join(REPO_ROOT, "openapi.yaml"), "utf8");
  const openApiPaths = extractOpenApiPaths(openApi);
  const errors = [];

  for (const literal of ROUTES_LITERALS) {
    if (!routesSource.includes(`"${literal}"`)) {
      errors.push(`routes.ts: missing literal route ${literal}`);
    }
    if (!openApiCoversLiteral(literal, openApiPaths)) {
      errors.push(`openapi.yaml: missing coverage for ${literal}`);
    }
  }

  for (const oaPath of openApiPaths) {
    if (!pathCoveredInRoutes(oaPath, routesSource)) {
      errors.push(`openapi.yaml: path ${oaPath} not implemented in routes.ts`);
    }
  }

  if (errors.length > 0) {
    console.error("[validate-openapi] Failed:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(
    `[validate-openapi] OK (${ROUTES_LITERALS.length} core routes, ${openApiPaths.length} OpenAPI paths)`
  );
}

main().catch((err) => {
  console.error("[validate-openapi] Failed:", err);
  process.exit(1);
});
