#!/usr/bin/env node
/**
 * Pre-release smoke: start built server and probe health/ready/version (PR-030).
 */

import { spawn } from "node:child_process";
import { request } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PORT = parseInt(process.env.SMOKE_PORT ?? "3847", 10);
const START_TIMEOUT_MS = parseInt(process.env.SMOKE_START_TIMEOUT_MS ?? "15000", 10);

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: "127.0.0.1", port: PORT, path, method: "GET" },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: chunks.join("") })
        );
      }
    );
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

async function waitForServer() {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await httpGet("/healthz");
      if (res.status === 200 || res.status === 503) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not respond on port ${PORT} within ${START_TIMEOUT_MS}ms`);
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function main() {
  const env = {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(PORT),
    RELEASE_ID: "smoke-release",
    BUILD_ID: "smoke-build",
  };
  delete env.OPERATIONAL_BEARER_TOKEN;

  const child = spawn("node", ["dist/server/index.js"], {
    cwd: REPO_ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (c) => {
    stderr += c.toString();
  });

  try {
    await waitForServer();

    const health = await httpGet("/healthz");
    if (health.status !== 200) {
      throw new Error(`/healthz expected 200, got ${health.status}: ${health.body}`);
    }

    const ready = await httpGet("/readyz");
    if (ready.status !== 200 && ready.status !== 503) {
      throw new Error(`/readyz unexpected ${ready.status}`);
    }

    const version = await httpGet("/v1/version");
    if (version.status !== 200) {
      throw new Error(`/v1/version expected 200, got ${version.status}`);
    }
    const body = JSON.parse(version.body);
    if (body.release_id !== "smoke-release" || body.build_id !== "smoke-build") {
      throw new Error(
        `version metadata mismatch: ${JSON.stringify({
          release_id: body.release_id,
          build_id: body.build_id,
        })}`
      );
    }

    console.log("[pre-release-smoke] OK: /healthz, /readyz, /v1/version");
  } finally {
    await stopChild(child);
    if (child.exitCode && child.exitCode !== 0 && stderr) {
      console.error(stderr.slice(-2000));
    }
  }
}

main().catch((err) => {
  console.error("[pre-release-smoke] Failed:", err.message ?? err);
  process.exit(1);
});
