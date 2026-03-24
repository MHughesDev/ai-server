/**
 * Async idempotency fingerprint tests.
 */

import { fingerprintAsyncQueryEnvelope } from "./async-idempotency.js";
import type { RequestEnvelope } from "../contracts/request-envelope.js";

function baseEnvelope(overrides: Partial<RequestEnvelope> = {}): RequestEnvelope {
  return {
    request_id: "550e8400-e29b-41d4-a716-446655440000",
    caller: {
      app_id: "app1",
      user_id: "user1",
      org_id: "org1",
      scopes: [],
    },
    input: { text: "hello", attachments: [] },
    preferences: { response_format: "text", verbosity: "medium", stream: false },
    contract_version: "v1",
    ...overrides,
  };
}

describe("fingerprintAsyncQueryEnvelope", () => {
  it("ignores request_id churn", () => {
    const a = baseEnvelope({ request_id: "550e8400-e29b-41d4-a716-446655440000" });
    const b = baseEnvelope({ request_id: "660e8400-e29b-41d4-a716-446655440001" });
    expect(fingerprintAsyncQueryEnvelope(a)).toBe(fingerprintAsyncQueryEnvelope(b));
  });

  it("changes when input text changes", () => {
    const a = baseEnvelope();
    const b = baseEnvelope({ input: { text: "other", attachments: [] } });
    expect(fingerprintAsyncQueryEnvelope(a)).not.toBe(fingerprintAsyncQueryEnvelope(b));
  });
});
