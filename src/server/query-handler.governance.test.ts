/**
 * Governance gate used by sync query and async preflight (WANT-013).
 */

import { bootstrap, resetConfigForTest } from "../bootstrap/index.js";
import { CONTRACT_VERSION } from "../contracts/index.js";
import { validateIngress } from "../ingress/validate.js";
import { resetTenantBudgets } from "../controlplane/tenant-budget.js";
import { preflightAsyncQueryGovernance } from "./query-handler.js";

const validBody = {
  request_id: "550e8400-e29b-41d4-a716-446655440000",
  caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
  input: { text: "hello", attachments: [], structured: undefined },
  preferences: { response_format: "text", verbosity: "medium", stream: false },
  contract_version: CONTRACT_VERSION,
};

const opts = {
  maxBodyBytes: 100_000,
  contractVersion: CONTRACT_VERSION,
};

describe("preflightAsyncQueryGovernance", () => {
  beforeEach(async () => {
    resetConfigForTest();
    await resetTenantBudgets();
    delete process.env.POLICY_DENY_ORG_IDS;
  });

  it("returns blocked ResponseEnvelope when policy denies org", async () => {
    process.env.POLICY_DENY_ORG_IDS = "o-deny";
    bootstrap();
    const body = {
      ...validBody,
      caller: { ...validBody.caller, org_id: "o-deny" },
    };
    const ir = validateIngress(body, opts);
    const blocked = await preflightAsyncQueryGovernance(ir);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe("blocked");
    expect(blocked?.error?.code).toBe("POLICY_BLOCKED");
  });

  it("returns null when governance allows dispatch", async () => {
    bootstrap();
    const ir = validateIngress(validBody, opts);
    const blocked = await preflightAsyncQueryGovernance(ir);
    expect(blocked).toBeNull();
  });
});
