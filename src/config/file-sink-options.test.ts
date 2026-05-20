/**
 * File sink option parsing tests (PR-012).
 */

import {
  resolveAuditFileSinkOptions,
  resolveEventFileSinkOptions,
} from "./file-sink-options.js";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("file-sink-options", () => {
  it("parses audit rotation env overrides", () => {
    process.env.AUDIT_LOG_MAX_FILE_BYTES = "5000";
    process.env.AUDIT_LOG_MAX_ROTATED_FILES = "5";
    process.env.AUDIT_LOG_FSYNC = "true";
    const opts = resolveAuditFileSinkOptions();
    expect(opts.maxFileSizeBytes).toBe(5000);
    expect(opts.maxRotatedFiles).toBe(5);
    expect(opts.fsyncAfterEachWrite).toBe(true);
  });

  it("parses observability rotation env overrides", () => {
    process.env.OBSERVABILITY_EVENT_SINK_MAX_FILE_BYTES = "8000";
    process.env.OBSERVABILITY_EVENT_SINK_MAX_ROTATED_FILES = "4";
    const opts = resolveEventFileSinkOptions();
    expect(opts.maxFileSizeBytes).toBe(8000);
    expect(opts.maxRotatedFiles).toBe(4);
  });
});
