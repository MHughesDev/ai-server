/**
 * Integration tests – token exchange, query auth, caller binding, and ingress rate limits.
 */

import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { request } from "node:http";
import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import { handleRequest } from "./routes.js";
import { resetQueryRateLimiterForTest } from "./rate-limit.js";

const originalEnv = process.env;

const AUTH_ISSUER = "https://idp.example.test";
const AUTH_AUDIENCE = "idp-token-exchange-aud";
const AUTH_IDP_SECRET = "idp-shared-secret";
const AUTH_AI_ISSUER = "ai-server-test";
const AUTH_AI_AUDIENCE = "ai-server-query";
const AUTH_AI_SECRET = "ai-server-signing-secret";
const AUTH_CLIENT_ID = "client-1";
const AUTH_CLIENT_SECRET = "client-secret-1";
const AUTH_APP_ID = "app-1";

const AUTH_IDP_REGISTRY_JSON = JSON.stringify([
  {
    issuer: AUTH_ISSUER,
    audience: AUTH_AUDIENCE,
    jwt_secret: AUTH_IDP_SECRET,
    claim_mapping: {
      org_id: "org_id",
      app_id: "azp",
      user_id: "sub",
      session_id: "sid",
      scopes: "scope",
    },
  },
]);

const AUTH_APP_REGISTRY_JSON = JSON.stringify([
  {
    client_id: AUTH_CLIENT_ID,
    client_secret: AUTH_CLIENT_SECRET,
    app_id: AUTH_APP_ID,
    allowed_issuers: [AUTH_ISSUER],
    allowed_scopes: ["query:invoke", "query:read"],
  },
]);

const validQueryBody = {
  request_id: "550e8400-e29b-41d4-a716-446655440010",
  caller: { app_id: AUTH_APP_ID, user_id: "user-1", org_id: "org-1", session_id: "sess-1" },
  input: { text: "hello", attachments: [] },
  preferences: { response_format: "text", verbosity: "medium", stream: false },
  contract_version: "v1",
};

function signJwtHs256(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header), "utf8").toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

function createExternalToken(overrides: Record<string, unknown> = {}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  return signJwtHs256(
    {
      iss: AUTH_ISSUER,
      aud: AUTH_AUDIENCE,
      sub: "user-1",
      org_id: "org-1",
      azp: AUTH_APP_ID,
      sid: "sess-1",
      scope: "query:invoke query:read",
      iat: nowSec,
      exp: nowSec + 300,
      ...overrides,
    },
    AUTH_IDP_SECRET
  );
}

function createAiToken(overrides: Record<string, unknown> = {}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  return signJwtHs256(
    {
      iss: AUTH_AI_ISSUER,
      aud: AUTH_AI_AUDIENCE,
      sub: "user-1",
      user_id: "user-1",
      org_id: "org-1",
      app_id: AUTH_APP_ID,
      session_id: "sess-1",
      scope: "query:invoke",
      scopes: ["query:invoke"],
      iat: nowSec,
      exp: nowSec + 300,
      ...overrides,
    },
    AUTH_AI_SECRET
  );
}

function applyAuthEnv(extra: Record<string, string> = {}): void {
  process.env = {
    ...originalEnv,
    NODE_ENV: "development",
    REQUIRE_AUTH_HEADER: "true",
    RUNTIME_MVP_QUERY_CHAT_ENABLED: "true",
    AUTH_AI_JWT_ISSUER: AUTH_AI_ISSUER,
    AUTH_AI_JWT_AUDIENCE: AUTH_AI_AUDIENCE,
    AUTH_AI_JWT_SECRET: AUTH_AI_SECRET,
    AUTH_QUERY_REQUIRED_SCOPES: "query:invoke",
    AUTH_IDP_REGISTRY_JSON,
    AUTH_APP_REGISTRY_JSON,
    INGRESS_RATE_LIMIT_MAX_REQUESTS: "0",
    INGRESS_RATE_LIMIT_WINDOW_MS: "60000",
    ...extra,
  };
}

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

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
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

beforeEach(() => {
  applyAuthEnv();
  resetConfigForTest();
  resetQueryRateLimiterForTest();
});

afterEach(() => {
  resetConfigForTest();
  resetQueryRateLimiterForTest();
});

afterAll(() => {
  process.env = originalEnv;
  resetConfigForTest();
  resetQueryRateLimiterForTest();
});

describe("token exchange and query auth", () => {
  it("issues AI JWT via /token/exchange and accepts /v1/query with matched caller", async () => {
    const { server, port } = await createTestServer();
    try {
      const exchange = await httpPost(port, "/token/exchange", {
        subject_token: createExternalToken(),
        client_id: AUTH_CLIENT_ID,
        client_secret: AUTH_CLIENT_SECRET,
      });
      expect(exchange.statusCode).toBe(200);
      const exchangePayload = JSON.parse(exchange.body) as { access_token?: string };
      expect(exchangePayload.access_token).toBeDefined();

      const query = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${exchangePayload.access_token as string}`,
      });
      expect(query.statusCode).toBe(200);
      const queryPayload = JSON.parse(query.body);
      expect(queryPayload.status).toBe("ok");
    } finally {
      await closeServer(server);
    }
  });

  it("rejects token exchange with invalid client credentials", async () => {
    const { server, port } = await createTestServer();
    try {
      const exchange = await httpPost(port, "/token/exchange", {
        subject_token: createExternalToken(),
        client_id: AUTH_CLIENT_ID,
        client_secret: "wrong-secret",
      });
      expect(exchange.statusCode).toBe(401);
      const parsed = JSON.parse(exchange.body);
      expect(parsed.error?.code).toBe("AUTH_INVALID");
    } finally {
      await closeServer(server);
    }
  });

  it("rejects /v1/query when body caller mismatches token claims", async () => {
    const { server, port } = await createTestServer();
    try {
      const token = createAiToken();
      const spoofed = {
        ...validQueryBody,
        caller: { ...validQueryBody.caller, org_id: "org-attacker" },
      };
      const query = await httpPost(port, "/v1/query", spoofed, {
        Authorization: `Bearer ${token}`,
      });
      expect(query.statusCode).toBe(401);
      const parsed = JSON.parse(query.body);
      expect(parsed.error?.code).toBe("AUTH_INVALID");
    } finally {
      await closeServer(server);
    }
  });

  it("rejects /v1/query for issuer/audience/scope mismatches", async () => {
    const { server, port } = await createTestServer();
    try {
      const issuerMismatch = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${createAiToken({ iss: "wrong-issuer" })}`,
      });
      expect(issuerMismatch.statusCode).toBe(401);
      expect(JSON.parse(issuerMismatch.body).error?.code).toBe("AUTH_INVALID");

      const audienceMismatch = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${createAiToken({ aud: "wrong-audience" })}`,
      });
      expect(audienceMismatch.statusCode).toBe(401);
      expect(JSON.parse(audienceMismatch.body).error?.code).toBe("AUTH_INVALID");

      const scopeMismatch = await httpPost(
        port,
        "/v1/query",
        {
          ...validQueryBody,
          caller: { ...validQueryBody.caller, scopes: [] },
        },
        {
          Authorization: `Bearer ${createAiToken({ scope: "query:read", scopes: ["query:read"] })}`,
        }
      );
      expect(scopeMismatch.statusCode).toBe(401);
      expect(JSON.parse(scopeMismatch.body).error?.code).toBe("AUTH_INVALID");
    } finally {
      await closeServer(server);
    }
  });

  it("rejects AI JWT without iat, with excessive lifetime, or sub/user_id mismatch (WANT-011)", async () => {
    const { server, port } = await createTestServer();
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const withoutIat = signJwtHs256(
        {
          iss: AUTH_AI_ISSUER,
          aud: AUTH_AI_AUDIENCE,
          sub: "user-1",
          user_id: "user-1",
          org_id: "org-1",
          app_id: AUTH_APP_ID,
          scope: "query:invoke",
          scopes: ["query:invoke"],
          exp: nowSec + 300,
        },
        AUTH_AI_SECRET
      );
      const noIatRes = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${withoutIat}`,
      });
      expect(noIatRes.statusCode).toBe(401);

      const tooLong = createAiToken({ iat: nowSec, exp: nowSec + 4000 });
      const longLifeRes = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${tooLong}`,
      });
      expect(longLifeRes.statusCode).toBe(401);
      expect(JSON.parse(longLifeRes.body).error?.detail?.max_seconds).toBe(3600);

      const subMismatch = createAiToken({ sub: "other-subject" });
      const subRes = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${subMismatch}`,
      });
      expect(subRes.statusCode).toBe(401);

      const zeroLifetime = createAiToken({ iat: nowSec, exp: nowSec });
      const orderRes = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${zeroLifetime}`,
      });
      expect(orderRes.statusCode).toBe(401);
    } finally {
      await closeServer(server);
    }
  });
});

describe("ingress rate limiting", () => {
  it("returns deterministic RATE_LIMITED (429) once over limit", async () => {
    applyAuthEnv({
      INGRESS_RATE_LIMIT_MAX_REQUESTS: "1",
      INGRESS_RATE_LIMIT_WINDOW_MS: "60000",
    });
    resetConfigForTest();
    resetQueryRateLimiterForTest();
    const { server, port } = await createTestServer();
    try {
      const token = createAiToken();
      const first = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${token}`,
      });
      expect(first.statusCode).toBe(200);

      const second = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${token}`,
      });
      expect(second.statusCode).toBe(429);
      const parsed = JSON.parse(second.body);
      expect(parsed.error?.code).toBe("RATE_LIMITED");
      expect(parsed.error?.detail?.retry_after_ms).toBeGreaterThanOrEqual(0);
    } finally {
      await closeServer(server);
    }
  });
});

describe("JWT clock skew tolerance (L2-05)", () => {
  it("accepts token within 10s clock skew for exp claim", async () => {
    const { server, port } = await createTestServer();
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      // exp 5s ago (within skew) but iat earlier so exp > iat and lifetime ≤ max (WANT-011)
      const token = createAiToken({ iat: nowSec - 400, exp: nowSec - 5 });
      const query = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${token}`,
      });
      // Should be accepted due to clock skew tolerance
      expect(query.statusCode).toBe(200);
    } finally {
      await closeServer(server);
    }
  });

  it("rejects token beyond 10s clock skew for exp claim", async () => {
    const { server, port } = await createTestServer();
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      // Token expired 15 seconds ago (beyond 10s tolerance)
      const token = createAiToken({ exp: nowSec - 15 });
      const query = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${token}`,
      });
      expect(query.statusCode).toBe(401);
      const parsed = JSON.parse(query.body);
      expect(parsed.error?.code).toBe("AUTH_INVALID");
      expect(parsed.error?.detail?.skew_tolerance).toBe(10);
    } finally {
      await closeServer(server);
    }
  });

  it("accepts token within 10s clock skew for nbf claim", async () => {
    const { server, port } = await createTestServer();
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      // Token not valid until 5 seconds in the future (within 10s tolerance)
      const token = createAiToken({ nbf: nowSec + 5 });
      const query = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${token}`,
      });
      // Should be accepted due to clock skew tolerance
      expect(query.statusCode).toBe(200);
    } finally {
      await closeServer(server);
    }
  });

  it("rejects token beyond 10s clock skew for nbf claim", async () => {
    const { server, port } = await createTestServer();
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      // Token not valid until 15 seconds in the future (beyond 10s tolerance)
      const token = createAiToken({ nbf: nowSec + 15 });
      const query = await httpPost(port, "/v1/query", validQueryBody, {
        Authorization: `Bearer ${token}`,
      });
      expect(query.statusCode).toBe(401);
      const parsed = JSON.parse(query.body);
      expect(parsed.error?.code).toBe("AUTH_INVALID");
      expect(parsed.error?.detail?.skew_tolerance).toBe(10);
    } finally {
      await closeServer(server);
    }
  });
});
