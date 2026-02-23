/**
 * Ingress validation tests – deterministic rejection paths.
 * @see L2-02 Phase 0 Task P0-03
 */

import { validateIngress } from "./validate.js";
import { CONTRACT_VERSION } from "../contracts/index.js";

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

describe("validateIngress", () => {
  it("accepts valid envelope and returns IngressResult", () => {
    const result = validateIngress(validBody, opts);
    expect(result.envelope.request_id).toBe(validBody.request_id);
    expect(result.callerContext.appId).toBe("a1");
    expect(result.callerContext.userId).toBe("u1");
  });

  it("rejects when body exceeds max size (contentLength)", () => {
    expect(() =>
      validateIngress(validBody, {
        ...opts,
        contentLength: 200_000,
      })
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_PAYLOAD",
        message: "Request body exceeds max size",
        httpStatus: 400,
      })
    );
  });

  it("rejects null body", () => {
    expect(() => validateIngress(null, opts)).toThrow(
      expect.objectContaining({
        code: "INVALID_PAYLOAD",
        message: "Request body is required",
      })
    );
  });

  it("rejects non-object body", () => {
    expect(() => validateIngress("string", opts)).toThrow(
      expect.objectContaining({
        code: "INVALID_PAYLOAD",
        message: "Request body must be a JSON object",
      })
    );
  });

  it("rejects invalid request_id (not UUID)", () => {
    expect(() =>
      validateIngress({ ...validBody, request_id: "not-uuid" }, opts)
    ).toThrow(expect.objectContaining({ code: "INVALID_PAYLOAD" }));
  });

  it("rejects unsupported contract_version", () => {
    expect(() =>
      validateIngress(
        { ...validBody, contract_version: "v0" },
        opts
      )
    ).toThrow(
      expect.objectContaining({
        code: "CONTRACT_VERSION_UNSUPPORTED",
        httpStatus: 400,
      })
    );
  });

  it("rejects when requireAuthHeader is true and authHeader missing", () => {
    expect(() =>
      validateIngress(validBody, { ...opts, requireAuthHeader: true })
    ).toThrow(
      expect.objectContaining({
        code: "AUTH_INVALID",
        httpStatus: 401,
      })
    );
  });

  it("passes when requireAuthHeader is true and authHeader present", () => {
    const result = validateIngress(validBody, {
      ...opts,
      requireAuthHeader: true,
      authHeader: "Bearer token",
    });
    expect(result.envelope.request_id).toBe(validBody.request_id);
  });

  it("normalizes request_id from header when missing in body", () => {
    const body = { ...validBody, request_id: undefined } as unknown as Record<string, unknown>;
    const headerRequestId = "550e8400-e29b-41d4-a716-446655440099";
    const result = validateIngress(body, {
      ...opts,
      requestIdHeader: headerRequestId,
    });
    expect(result.envelope.request_id).toBe(headerRequestId);
  });

  describe("L2-07 multimodal attachment validation", () => {
    it("when multimodalInputPathEnabled false, accepts request with attachments without validating them", () => {
      const bodyWithAttachments = {
        ...validBody,
        input: {
          text: "hello",
          attachments: [
            { id: "a1", type: "other", uri: "https://example.com/x.bin" },
          ],
        },
      };
      const result = validateIngress(bodyWithAttachments, opts);
      expect(result.envelope.input.attachments).toHaveLength(1);
    });

    it("when multimodalInputPathEnabled true, rejects unsupported attachment type", () => {
      const bodyWithAttachments = {
        ...validBody,
        input: {
          text: "hello",
          attachments: [
            { id: "a1", type: "other", uri: "https://example.com/x.bin" },
          ],
        },
      };
      expect(() =>
        validateIngress(bodyWithAttachments, {
          ...opts,
          multimodalInputPathEnabled: true,
        })
      ).toThrow(
        expect.objectContaining({
          code: "ATTACHMENT_REJECTED",
          message: expect.stringContaining("unsupported_type"),
          httpStatus: 400,
        })
      );
    });

    it("when multimodalInputPathEnabled true, accepts valid image attachment", () => {
      const bodyWithAttachments = {
        ...validBody,
        input: {
          text: "see image",
          attachments: [
            {
              id: "a1",
              type: "image",
              uri: "https://example.com/1.png",
              meta: { mime: "image/png" },
            },
          ],
        },
      };
      const result = validateIngress(bodyWithAttachments, {
        ...opts,
        multimodalInputPathEnabled: true,
      });
      expect(result.envelope.input.attachments).toHaveLength(1);
    });

    it("when multimodalInputPathEnabled true, rejects count_exceeded", () => {
      const bodyWithAttachments = {
        ...validBody,
        input: {
          text: "hello",
          attachments: Array.from({ length: 11 }, (_, i) => ({
            id: `a${i}`,
            type: "image" as const,
            uri: `https://example.com/${i}.png`,
            meta: { mime: "image/png" },
          })),
        },
      };
      expect(() =>
        validateIngress(bodyWithAttachments, {
          ...opts,
          multimodalInputPathEnabled: true,
          attachmentLimits: { maxCount: 10 },
        })
      ).toThrow(
        expect.objectContaining({
          code: "ATTACHMENT_REJECTED",
          message: expect.stringContaining("count_exceeded"),
          httpStatus: 400,
        })
      );
    });
  });
});
