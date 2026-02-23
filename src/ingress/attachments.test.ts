/**
 * Attachment validation tests – L2-07 Phase 0 Task P0-03.
 */

import {
  validateAttachments,
  getDefaultAttachmentLimits,
} from "./attachments.js";

describe("validateAttachments", () => {
  it("accepts empty attachments", () => {
    const result = validateAttachments([]);
    expect(result.valid).toBe(true);
  });

  it("accepts valid image attachment with uri and mime", () => {
    const result = validateAttachments([
      { id: "a1", type: "image", uri: "https://example.com/x.png", meta: { mime: "image/png" } },
    ]);
    expect(result.valid).toBe(true);
  });

  it("rejects when count exceeds maxCount", () => {
    const limits = getDefaultAttachmentLimits();
    const many = Array.from({ length: limits.maxCount + 1 }, (_, i) => ({
      id: `a${i}`,
      type: "image" as const,
      uri: `https://example.com/${i}.png`,
    }));
    const result = validateAttachments(many);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("count_exceeded");
      expect(result.detail?.max_count).toBe(limits.maxCount);
      expect(result.detail?.received).toBe(limits.maxCount + 1);
    }
  });

  it("rejects unsupported type", () => {
    const result = validateAttachments([
      { id: "a1", type: "other", uri: "https://example.com/x.bin" },
    ]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("unsupported_type");
      expect(result.attachmentId).toBe("a1");
      expect(result.detail?.type).toBe("other");
    }
  });

  it("rejects invalid mime when allowlist is set", () => {
    const result = validateAttachments(
      [{ id: "a1", type: "image", meta: { mime: "application/octet-stream" } }],
      { allowedMimeTypes: ["image/png", "image/jpeg"] }
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid_mime");
      expect(result.detail?.mime).toBe("application/octet-stream");
    }
  });

  it("accepts when mime is in allowlist", () => {
    const result = validateAttachments(
      [{ id: "a1", type: "image", meta: { mime: "image/png" } }],
      { allowedMimeTypes: ["image/png", "image/jpeg"] }
    );
    expect(result.valid).toBe(true);
  });

  it("rejects when content_b64 exceeds max bytes", () => {
    const smallBase64 = "AAAA"; // 3 bytes decoded
    const maxBytes = 2;
    const result = validateAttachments(
      [{ id: "a1", type: "image", content_b64: smallBase64 }],
      { maxBytesPerAttachment: maxBytes }
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("too_large");
      expect(result.detail?.max_bytes).toBe(maxBytes);
    }
  });

  it("accepts when content_b64 within limit", () => {
    const result = validateAttachments(
      [{ id: "a1", type: "image", content_b64: "AAAA" }],
      { maxBytesPerAttachment: 10 }
    );
    expect(result.valid).toBe(true);
  });

  it("accepts pdf type when in allowedTypes", () => {
    const result = validateAttachments([
      { id: "a1", type: "pdf", uri: "https://example.com/d.pdf", meta: { mime: "application/pdf" } },
    ]);
    expect(result.valid).toBe(true);
  });

  describe("L2-07 abuse / reliability", () => {
    it("rejects oversized content_b64 (deterministic too_large)", () => {
      const oneMegBase64 = "A".repeat(Math.ceil((1024 * 1024 * 4) / 3)); // ~4MB decoded
      const result = validateAttachments(
        [{ id: "a1", type: "image", content_b64: oneMegBase64 }],
        { maxBytesPerAttachment: 1024 * 1024 }
      );
      expect(result.valid).toBe(false);
      expect(result.valid === false && result.reason).toBe("too_large");
    });

    it("deterministic: same invalid input yields same reason", () => {
      const att = [{ id: "x", type: "other" as const }];
      const r1 = validateAttachments(att);
      const r2 = validateAttachments(att);
      expect(r1).toEqual(r2);
      if (!r1.valid && !r2.valid) {
        expect(r1.reason).toBe(r2.reason);
      }
    });
  });
});
