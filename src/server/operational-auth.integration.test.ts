/**
 * Integration tests – OPERATIONAL_BEARER_TOKEN protects ops endpoints (PR-001).
 * @see to-do.md PR-001
 */

import { createServer } from "node:http";
import { request } from "node:http";
import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import { handleRequest } from "./routes.js";

const originalEnv = process.env;
const OPS_TOKEN = "test-operational-bearer-token";

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

function createTestServer(): Promise<{ server: ReturnType<typeof createServer>; port: number }> {
  return new Promise((resolve) => {
    bootstrap();
    const server = createServer((req, res) => {
      void handleRequest(req, res).catch((err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      });
    });
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr?.port ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

describe("operational bearer token (PR-001)", () => {
  beforeEach(() => {
    resetConfigForTest();
    process.env = { ...originalEnv, NODE_ENV: "development" };
  });

  afterAll(() => {
    process.env = originalEnv;
    resetConfigForTest();
  });

  it("rejects /healthz without Bearer when OPERATIONAL_BEARER_TOKEN is set", async () => {
    process.env.OPERATIONAL_BEARER_TOKEN = OPS_TOKEN;
    const { server, port } = await createTestServer();
    try {
      const res = await httpGet(port, "/healthz");
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body) as { error?: { code?: string } };
      expect(body.error?.code).toBe("AUTH_INVALID");
    } finally {
      await closeServer(server);
    }
  });

  it("allows /healthz with matching Bearer when OPERATIONAL_BEARER_TOKEN is set", async () => {
    process.env.OPERATIONAL_BEARER_TOKEN = OPS_TOKEN;
    const { server, port } = await createTestServer();
    try {
      const res = await httpGet(port, "/healthz", {
        Authorization: `Bearer ${OPS_TOKEN}`,
      });
      expect(res.statusCode).not.toBe(401);
    } finally {
      await closeServer(server);
    }
  });

  it("rejects /metrics and /v1/version without Bearer when token is set", async () => {
    process.env.OPERATIONAL_BEARER_TOKEN = OPS_TOKEN;
    const { server, port } = await createTestServer();
    try {
      for (const path of ["/metrics", "/v1/version"]) {
        const res = await httpGet(port, path);
        expect(res.statusCode).toBe(401);
      }
    } finally {
      await closeServer(server);
    }
  });

  it("allows /healthz without Bearer when OPERATIONAL_BEARER_TOKEN is unset (dev)", async () => {
    delete process.env.OPERATIONAL_BEARER_TOKEN;
    const { server, port } = await createTestServer();
    try {
      const res = await httpGet(port, "/healthz");
      expect(res.statusCode).not.toBe(401);
    } finally {
      await closeServer(server);
    }
  });
});
