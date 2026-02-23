/**
 * L2-06 Retrieval integration – full path with retrieval enabled (ingest → query → citations).
 * Sets env before bootstrap so server runs with memory_retrieval_enabled and org scope.
 */

import { createServer } from "node:http";
import { request } from "node:http";
import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import { handleRequest } from "./routes.js";
import { getDefaultStore } from "../memory/default-store.js";
import { InMemoryStore } from "../memory/in-memory-store.js";

function createTestServer(): Promise<{ server: ReturnType<typeof createServer>; port: number }> {
  return new Promise((resolve) => {
    bootstrap();
    const server = createServer((req, res) => {
      handleRequest(req, res).catch((err) => {
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

function httpPost(
  port: number,
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request(
      {
        host: "localhost",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        const chunks: string[] = [];
        res.on("data", (chunk) => chunks.push(chunk.toString()));
        res.on("end", () =>
          resolve({ statusCode: res.statusCode ?? 0, body: chunks.join("") })
        );
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

const validQueryBody = {
  request_id: "550e8400-e29b-41d4-a716-446655440001",
  caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
  input: { text: "What is the alpha beta content?", attachments: [] },
  preferences: { response_format: "text", verbosity: "medium", stream: false },
  contract_version: "v1",
};

describe("L2-06 retrieval integration (full path)", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  const envSnapshot: Record<string, string | undefined> = {};

  beforeAll(async () => {
    envSnapshot.MEMORY_RETRIEVAL_ENABLED = process.env.MEMORY_RETRIEVAL_ENABLED;
    envSnapshot.ENABLE_ORG_MEMORY = process.env.ENABLE_ORG_MEMORY;
    envSnapshot.RUNTIME_MVP_QUERY_CHAT_ENABLED = process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED;

    resetConfigForTest();
    process.env.MEMORY_RETRIEVAL_ENABLED = "true";
    process.env.ENABLE_ORG_MEMORY = "true";
    process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED = "true";

    const store = getDefaultStore();
    if (!("ingest" in store) || typeof store.ingest !== "function") {
      throw new Error("Default store must support ingest for this test");
    }
    if (store instanceof InMemoryStore) {
      store.clear();
    }
    await store.ingest({
      document_id: "l2-06-e2e-doc",
      text: "The alpha beta gamma content is used for L2-06 retrieval integration tests.",
      scope: "org",
      scope_keys: { org_id: "o1" },
      source_label: "l2-06-e2e.txt",
    });

    const s = await createTestServer();
    server = s.server;
    port = s.port;
  });

  afterAll((done) => {
    if (envSnapshot.MEMORY_RETRIEVAL_ENABLED !== undefined) {
      process.env.MEMORY_RETRIEVAL_ENABLED = envSnapshot.MEMORY_RETRIEVAL_ENABLED;
    } else {
      delete process.env.MEMORY_RETRIEVAL_ENABLED;
    }
    if (envSnapshot.ENABLE_ORG_MEMORY !== undefined) {
      process.env.ENABLE_ORG_MEMORY = envSnapshot.ENABLE_ORG_MEMORY;
    } else {
      delete process.env.ENABLE_ORG_MEMORY;
    }
    if (envSnapshot.RUNTIME_MVP_QUERY_CHAT_ENABLED !== undefined) {
      process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED = envSnapshot.RUNTIME_MVP_QUERY_CHAT_ENABLED;
    } else {
      delete process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED;
    }
    resetConfigForTest();
    server.close(done);
  });

  it("returns 200 with citations when retrieval enabled and corpus matches", async () => {
    const { statusCode, body } = await httpPost(port, "/v1/query", validQueryBody);
    expect(statusCode).toBe(200);
    const parsed = JSON.parse(body) as {
      status: string;
      request_id: string;
      output?: { text?: string; citations?: Array<{ source: string; ref: string; span?: string }> };
    };
    expect(parsed.status).toBe("ok");
    expect(parsed.request_id).toBe(validQueryBody.request_id);
    expect(Array.isArray(parsed.output?.citations)).toBe(true);
    expect(parsed.output!.citations!.length).toBeGreaterThan(0);
    expect(parsed.output!.citations![0]).toMatchObject({
      source: expect.any(String),
      ref: expect.any(String),
    });
  });
});
