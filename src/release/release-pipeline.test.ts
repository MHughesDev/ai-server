/**
 * Release CI pipeline scripts (PR-030).
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function runScript(script: string, env?: NodeJS.ProcessEnv): { status: number | null; stderr: string } {
  const result = spawnSync("node", [script], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return { status: result.status, stderr: result.stderr ?? "" };
}

describe("release pipeline scripts (PR-030)", () => {
  it("validates k8s manifests", () => {
    const { status, stderr } = runScript("scripts/validate-k8s-manifests.mjs");
    expect(status).toBe(0);
    if (status !== 0) console.error(stderr);
  });

  it("validates openapi.yaml against routes.ts", () => {
    const { status, stderr } = runScript("scripts/validate-openapi-routes.mjs");
    expect(status).toBe(0);
    if (status !== 0) console.error(stderr);
  });

  it("builds, signs, and verifies release artifact manifest", () => {
    const build = runScript("scripts/release/build-artifact-manifest.mjs", {
      RELEASE_ID: "test-release",
      BUILD_ID: "test-build",
    });
    expect(build.status).toBe(0);

    const signKey = "test-signing-key-pr-030";
    const sign = runScript("scripts/release/sign-artifact-manifest.mjs", {
      RELEASE_SIGNING_KEY: signKey,
    });
    expect(sign.status).toBe(0);

    const verify = runScript("scripts/release/verify-artifact-manifest.mjs", {
      RELEASE_SIGNING_KEY: signKey,
    });
    expect(verify.status).toBe(0);
  });
});
