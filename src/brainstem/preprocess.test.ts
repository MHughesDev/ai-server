/**
 * Preprocess tests – L2-07 Phase 1 deterministic canonicalization.
 */

import {
  preprocessAttachment,
  preprocessAttachments,
} from "./preprocess.js";

describe("preprocessAttachment", () => {
  it("returns token_estimate and mime for image", () => {
    const result = preprocessAttachment({
      id: "a1",
      type: "image",
      uri: "https://example.com/1.png",
      meta: { mime: "image/png" },
    });
    expect(result.token_estimate).toBe(256);
    expect(result.mime).toBe("image/png");
  });

  it("returns higher token_estimate for pdf", () => {
    const result = preprocessAttachment({
      id: "a2",
      type: "pdf",
      uri: "https://example.com/d.pdf",
    });
    expect(result.token_estimate).toBe(512);
  });

  it("computes json token_estimate from content_b64 length", () => {
    const base64 = "e30="; // "{}" = 2 bytes -> ~1 token, clamped to min 128
    const result = preprocessAttachment({
      id: "a3",
      type: "json",
      content_b64: base64,
    });
    expect(result.token_estimate).toBeGreaterThanOrEqual(128);
    expect(result.token_estimate).toBeLessThanOrEqual(4096);
  });

  it("is deterministic for same input", () => {
    const att = { id: "x", type: "image" as const, meta: { mime: "image/jpeg" } };
    expect(preprocessAttachment(att)).toEqual(preprocessAttachment(att));
  });
});

describe("preprocessAttachments", () => {
  it("returns results in same order as input", () => {
    const attachments = [
      { id: "1", type: "image" as const },
      { id: "2", type: "pdf" as const },
    ];
    const results = preprocessAttachments(attachments);
    expect(results).toHaveLength(2);
    expect(results[0].token_estimate).toBe(256);
    expect(results[1].token_estimate).toBe(512);
  });
});
