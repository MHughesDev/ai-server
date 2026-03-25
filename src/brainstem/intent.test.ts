/**
 * Brain Stem intent extraction tests.
 * @see L2-02 Phase 1 Task P1-02
 */

import { extractIntent } from "./intent.js";
import type { CanonicalRequest } from "../contracts/canonical-request.js";

describe("extractIntent", () => {
  it("returns chat primary_intent with confidence 1", () => {
    const canonical: CanonicalRequest = {
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      modalities: ["text"],
      text: "hello",
      attachments: [],
      token_estimate: 10,
      caller_app_id: "a1",
      caller_user_id: "u1",
      caller_org_id: "o1",
    };
    const intent = extractIntent(canonical);
    expect(intent.primary_intent).toBe("chat");
    expect(intent.confidence).toBe(1);
    expect(intent.intents).toContain("chat");
    expect(intent.routing_hints).toContain("reactive_chat");
    expect(intent.constraints_hints?.needs_attachment_processing).toBeUndefined();
  });

  it("sets needs_attachment_processing when canonical modalities include image", () => {
    const canonical: CanonicalRequest = {
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      modalities: ["text", "image"],
      text: "hello",
      attachments: [],
      token_estimate: 10,
      caller_app_id: "a1",
      caller_user_id: "u1",
      caller_org_id: "o1",
    };
    const intent = extractIntent(canonical);
    expect(intent.constraints_hints?.needs_attachment_processing).toBe(true);
    expect(intent.modalities_detected).toContain("image");
  });

  it("sets needs_attachment_processing when canonical modalities include file", () => {
    const canonical: CanonicalRequest = {
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      modalities: ["text", "file"],
      text: "hello",
      attachments: [],
      token_estimate: 10,
      caller_app_id: "a1",
      caller_user_id: "u1",
      caller_org_id: "o1",
    };
    expect(extractIntent(canonical).constraints_hints?.needs_attachment_processing).toBe(true);
  });
});
