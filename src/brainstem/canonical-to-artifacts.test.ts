/**
 * Canonical-to-Artifacts tests – M2 Typed Artifacts from CanonicalRequest.
 */

import { canonicalToTypedArtifacts, SCHEMA_REF_USER_INPUT, SCHEMA_REF_ATTACHMENT_HANDLE } from "./canonical-to-artifacts.js";
import type { CanonicalRequest } from "../contracts/canonical-request.js";

function makeCanonical(overrides: Partial<CanonicalRequest> = {}): CanonicalRequest {
  return {
    request_id: "550e8400-e29b-41d4-a716-446655440000",
    modalities: ["text"],
    text: "hello world",
    attachments: [],
    token_estimate: 10,
    caller_app_id: "a1",
    caller_user_id: "u1",
    caller_org_id: "o1",
    ...overrides,
  };
}

describe("canonicalToTypedArtifacts", () => {
  it("returns one report artifact for text with artifact_kind and schema_ref", () => {
    const canonical = makeCanonical({ text: "hello" });
    const artifacts = canonicalToTypedArtifacts(canonical);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].artifact_kind).toBe("report");
    expect(artifacts[0].schema_ref).toBe(SCHEMA_REF_USER_INPUT);
    expect(artifacts[0].encoding).toBe("text");
    expect(artifacts[0].content?.inline).toBe("hello");
    expect(artifacts[0].metadata?.provenance).toBe("canonicalize");
  });

  it("returns empty array when text is empty and no attachments", () => {
    const canonical = makeCanonical({ text: "" });
    const artifacts = canonicalToTypedArtifacts(canonical);
    expect(artifacts).toHaveLength(0);
  });

  it("returns one artifact per attachment with schema_ref and ref content", () => {
    const canonical = makeCanonical({
      text: "",
      attachments: [
        { id: "att1", type: "pdf", uri: "https://example.com/doc.pdf", token_estimate: 100 },
        { id: "att2", type: "image", uri: "https://example.com/img.png" },
      ],
    });
    const artifacts = canonicalToTypedArtifacts(canonical);
    expect(artifacts).toHaveLength(2);
    expect(artifacts[0].artifact_id).toBe("att1");
    expect(artifacts[0].artifact_kind).toBe("document_chunk");
    expect(artifacts[0].schema_ref).toBe(SCHEMA_REF_ATTACHMENT_HANDLE);
    expect(artifacts[0].content?.ref).toBe("https://example.com/doc.pdf");
    expect(artifacts[1].artifact_id).toBe("att2");
    expect(artifacts[1].content?.ref).toBe("https://example.com/img.png");
  });

  it("returns text artifact plus attachment artifacts when both present", () => {
    const canonical = makeCanonical({
      text: "summarize this",
      attachments: [{ id: "a1", type: "pdf", uri: "file:///doc.pdf" }],
    });
    const artifacts = canonicalToTypedArtifacts(canonical);
    expect(artifacts).toHaveLength(2);
    expect(artifacts[0].artifact_kind).toBe("report");
    expect(artifacts[0].content?.inline).toBe("summarize this");
    expect(artifacts[1].artifact_kind).toBe("document_chunk");
    expect(artifacts[1].content?.ref).toBe("file:///doc.pdf");
  });
});
