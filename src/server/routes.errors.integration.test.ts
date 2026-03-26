/**
 * Integration tests – structured 404 bodies from `routes.ts` (WANT-048).
 */

import { createServer } from "node:http";
import { request } from "node:http";
import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import type { JobQueueService } from "../queue/job-queue.js";
import { handleRequest, setJobQueueService } from "./routes.js";

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

function httpGet(port: number, path: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: "localhost", port, path, method: "GET" },
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

const minimalQueryBody = {
  request_id: "550e8400-e29b-41d4-a716-446655440000",
  caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
  input: { text: "hi", attachments: [] },
  preferences: { response_format: "text", verbosity: "medium", stream: false },
  contract_version: "v1",
};

describe("routes.ts structured 404 errors", () => {
  it("returns NOT_FOUND ApiPlainError for unknown paths", async () => {
    const prevMvp = process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED;
    process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED = "true";
    resetConfigForTest();
    const { server, port } = await createTestServer();
    try {
      const { statusCode, body } = await httpGet(port, "/v1/no-such-route");
      expect(statusCode).toBe(404);
      const parsed = JSON.parse(body) as {
        status?: string;
        error?: { code?: string; message?: string };
      };
      expect(parsed.status).toBe("error");
      expect(parsed.error?.code).toBe("NOT_FOUND");
      expect(parsed.error?.message).toBe("Not found");
    } finally {
      server.close();
      resetConfigForTest();
      if (prevMvp !== undefined) process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED = prevMvp;
      else delete process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED;
      bootstrap();
    }
  });

  it("returns MVP_QUERY_DISABLED when runtime_mvp_query_chat_enabled is false", async () => {
    const prevMvp = process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED;
    process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED = "false";
    resetConfigForTest();
    const { server, port } = await createTestServer();
    try {
      const { statusCode, body } = await httpPost(port, "/v1/query", minimalQueryBody);
      expect(statusCode).toBe(404);
      const parsed = JSON.parse(body) as {
        status?: string;
        error?: { code?: string; message?: string };
      };
      expect(parsed.status).toBe("error");
      expect(parsed.error?.code).toBe("MVP_QUERY_DISABLED");
      expect(parsed.error?.message).toContain("MVP");
    } finally {
      server.close();
      resetConfigForTest();
      if (prevMvp !== undefined) process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED = prevMvp;
      else delete process.env.RUNTIME_MVP_QUERY_CHAT_ENABLED;
      bootstrap();
    }
  });
});

describe("HTTP request processing deadline (WANT-015)", () => {
  it("returns 504 TIMEOUT when async submit stalls beyond REQUEST_PROCESSING_TIMEOUT_MS", async () => {
    const prevTimeout = process.env.REQUEST_PROCESSING_TIMEOUT_MS;
    process.env.REQUEST_PROCESSING_TIMEOUT_MS = "150";
    resetConfigForTest();
    const { server, port } = await createTestServer();
    const never = new Promise<never>(() => {});
    const stallSubmit: JobQueueService = {
      submitJob: () => never,
      getJob: async () => null,
      cancelJob: async () => false,
      listJobs: async () => [],
      start: async () => {},
      stop: async () => {},
    } as unknown as JobQueueService;
    setJobQueueService(stallSubmit);
    try {
      const { statusCode, body } = await httpPost(port, "/v1/query/async", minimalQueryBody);
      expect(statusCode).toBe(504);
      const parsed = JSON.parse(body) as {
        status?: string;
        error?: { code?: string; detail?: { timeout_ms?: number } };
      };
      expect(parsed.status).toBe("error");
      expect(parsed.error?.code).toBe("TIMEOUT");
      expect(parsed.error?.detail?.timeout_ms).toBe(150);
    } finally {
      server.close();
      resetConfigForTest();
      if (prevTimeout !== undefined) process.env.REQUEST_PROCESSING_TIMEOUT_MS = prevTimeout;
      else delete process.env.REQUEST_PROCESSING_TIMEOUT_MS;
      bootstrap();
    }
  }, 10_000);

  it("returns 504 TIMEOUT when GET /v1/jobs/{id} getJob stalls", async () => {
    const prevTimeout = process.env.REQUEST_PROCESSING_TIMEOUT_MS;
    process.env.REQUEST_PROCESSING_TIMEOUT_MS = "150";
    resetConfigForTest();
    const { server, port } = await createTestServer();
    const never = new Promise<never>(() => {});
    const stallGet: JobQueueService = {
      submitJob: async () => {
        throw new Error("not used");
      },
      getJob: () => never,
      cancelJob: async () => false,
      listJobs: async () => [],
      start: async () => {},
      stop: async () => {},
    } as unknown as JobQueueService;
    setJobQueueService(stallGet);
    try {
      const { statusCode, body } = await httpGet(port, "/v1/jobs/j1");
      expect(statusCode).toBe(504);
      const parsed = JSON.parse(body) as { error?: { code?: string; detail?: { timeout_ms?: number } } };
      expect(parsed.error?.code).toBe("TIMEOUT");
      expect(parsed.error?.detail?.timeout_ms).toBe(150);
    } finally {
      server.close();
      resetConfigForTest();
      if (prevTimeout !== undefined) process.env.REQUEST_PROCESSING_TIMEOUT_MS = prevTimeout;
      else delete process.env.REQUEST_PROCESSING_TIMEOUT_MS;
      bootstrap();
    }
  }, 10_000);

  it("returns 504 TIMEOUT when GET /v1/jobs listJobs stalls", async () => {
    const prevTimeout = process.env.REQUEST_PROCESSING_TIMEOUT_MS;
    process.env.REQUEST_PROCESSING_TIMEOUT_MS = "150";
    resetConfigForTest();
    const { server, port } = await createTestServer();
    const never = new Promise<never>(() => {});
    const stallList: JobQueueService = {
      submitJob: async () => {
        throw new Error("not used");
      },
      getJob: async () => null,
      cancelJob: async () => false,
      listJobs: () => never,
      start: async () => {},
      stop: async () => {},
    } as unknown as JobQueueService;
    setJobQueueService(stallList);
    try {
      const { statusCode, body } = await httpGet(port, "/v1/jobs");
      expect(statusCode).toBe(504);
      const parsed = JSON.parse(body) as { error?: { code?: string; detail?: { timeout_ms?: number } } };
      expect(parsed.error?.code).toBe("TIMEOUT");
    } finally {
      server.close();
      resetConfigForTest();
      if (prevTimeout !== undefined) process.env.REQUEST_PROCESSING_TIMEOUT_MS = prevTimeout;
      else delete process.env.REQUEST_PROCESSING_TIMEOUT_MS;
      bootstrap();
    }
  }, 10_000);

  it("returns 504 TIMEOUT when POST /v1/jobs/{id}/cancel stalls", async () => {
    const prevTimeout = process.env.REQUEST_PROCESSING_TIMEOUT_MS;
    process.env.REQUEST_PROCESSING_TIMEOUT_MS = "150";
    resetConfigForTest();
    const { server, port } = await createTestServer();
    const never = new Promise<never>(() => {});
    const stallCancel: JobQueueService = {
      submitJob: async () => {
        throw new Error("not used");
      },
      getJob: async () => null,
      cancelJob: () => never,
      listJobs: async () => [],
      start: async () => {},
      stop: async () => {},
    } as unknown as JobQueueService;
    setJobQueueService(stallCancel);
    try {
      const { statusCode, body } = await httpPost(port, "/v1/jobs/j1/cancel", {});
      expect(statusCode).toBe(504);
      const parsed = JSON.parse(body) as { error?: { code?: string } };
      expect(parsed.error?.code).toBe("TIMEOUT");
    } finally {
      server.close();
      resetConfigForTest();
      if (prevTimeout !== undefined) process.env.REQUEST_PROCESSING_TIMEOUT_MS = prevTimeout;
      else delete process.env.REQUEST_PROCESSING_TIMEOUT_MS;
      bootstrap();
    }
  }, 10_000);
});
