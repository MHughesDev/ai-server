/**
 * Integration tests — RELEASE_ID / BUILD_ID on GET /v1/version (PR-004).
 */

import { createServer } from "node:http";
import { request } from "node:http";
import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import { handleRequest } from "./routes.js";

const originalEnv = process.env;

function httpGet(
  port: number,
  path: string,
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: "localhost", port, path, method: "GET", headers },
      (res) => {
        const chunks: string[] = [];
        res.on("data", (chunk) => chunks.push(chunk.toString()));
        res.on("end", () =>
          resolve({ statusCode: res.statusCode ?? 0, body: chunks.join("") })
        );
      }
    );
    req.on("error", reject);
    req.end();
  });
}

describe("release metadata (PR-004)", () => {
  beforeEach(() => {
    resetConfigForTest();
    process.env = { ...originalEnv, NODE_ENV: "development" };
    process.env.OPERATIONAL_BEARER_TOKEN = "ops-version-test";
    process.env.RELEASE_ID = "release-integration-test";
    process.env.BUILD_ID = "build-integration-test";
  });

  afterAll(() => {
    process.env = originalEnv;
    resetConfigForTest();
  });

  it("exposes release_id and build_id on GET /v1/version", async () => {
    bootstrap();
    const server = createServer((req, res) => {
      void handleRequest(req, res).catch((err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const addr = server.address();
    const port = typeof addr === "object" && addr?.port ? addr.port : 0;

    try {
      const res = await httpGet(port, "/v1/version", {
        Authorization: "Bearer ops-version-test",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        release_id?: string;
        build_id?: string;
      };
      expect(body.release_id).toBe("release-integration-test");
      expect(body.build_id).toBe("build-integration-test");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
