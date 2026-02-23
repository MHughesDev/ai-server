/**
 * Brain Stem canonicalize tests.
 * @see L2-02 Phase 1 Task P1-01
 */

import { canonicalize } from "./canonicalize.js";
import type { RequestEnvelope } from "../contracts/request-envelope.js";

describe("canonicalize", () => {
  it("produces CanonicalRequest from valid envelope", () => {
    const envelope: RequestEnvelope = {
      request_id: "550e8400-e29b-41d4-a716-446655440000",
      caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
      input: { text: "  hello world  ", attachments: [] },
      preferences: { response_format: "text", verbosity: "medium", stream: false },
      contract_version: "v1",
    };
    const canonical = canonicalize(envelope);
    expect(canonical.request_id).toBe(envelope.request_id);
    expect(canonical.text).toBe("hello world");
    expect(canonical.modalities).toContain("text");
    expect(canonical.caller_app_id).toBe("a1");
    expect(canonical.token_estimate).toBeGreaterThanOrEqual(0);
  });

  it("defaults text to empty when input.text missing", () => {
    const envelope: RequestEnvelope = {
      request_id: "550e8400-e29b-41d4-a716-446655440001",
      caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
      input: {},
      preferences: { response_format: "text", verbosity: "medium", stream: false },
      contract_version: "v1",
    };
    const canonical = canonicalize(envelope);
    expect(canonical.text).toBe("");
    expect(canonical.modalities).toEqual(["text"]);
  });

  it("maps attachments to handles with id, type, uri, mime", () => {
    const envelope: RequestEnvelope = {
      request_id: "550e8400-e29b-41d4-a716-446655440002",
      caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
      input: {
        text: "see image",
        attachments: [
          { id: "att1", type: "image", uri: "https://example.com/1.png", meta: { mime: "image/png" } },
        ],
      },
      preferences: { response_format: "text", verbosity: "medium", stream: false },
      contract_version: "v1",
    };
    const canonical = canonicalize(envelope);
    expect(canonical.attachments).toHaveLength(1);
    expect(canonical.attachments[0].id).toBe("att1");
    expect(canonical.attachments[0].type).toBe("image");
    expect(canonical.attachments[0].uri).toBe("https://example.com/1.png");
    expect(canonical.attachments[0].mime).toBe("image/png");
    expect(canonical.attachments[0].token_estimate).toBe(256);
    expect(canonical.modalities).toContain("image");
  });

  it("includes token_estimate from preprocessors in total token_estimate", () => {
    const envelope: RequestEnvelope = {
      request_id: "550e8400-e29b-41d4-a716-446655440003",
      caller: { app_id: "a1", user_id: "u1", org_id: "o1", scopes: [] },
      input: {
        text: "hi",
        attachments: [
          { id: "img1", type: "image", uri: "https://example.com/1.png" },
          { id: "pdf1", type: "pdf", uri: "https://example.com/1.pdf" },
        ],
      },
      preferences: { response_format: "text", verbosity: "medium", stream: false },
      contract_version: "v1",
    };
    const canonical = canonicalize(envelope);
    expect(canonical.attachments[0].token_estimate).toBe(256);
    expect(canonical.attachments[1].token_estimate).toBe(512);
    expect(canonical.token_estimate).toBeGreaterThanOrEqual(256 + 512);
  });
});
