import { loadConfigFromEnv } from "./schema.js";
import {
  assertProductionToolExecution,
  isToolExecutionEnvFlagEnabled,
  isToolExecutionSecurityReviewSignoffAcknowledged,
  resolveToolExecutionEnabled,
} from "./assert-production-tool-execution.js";

const originalEnv = process.env;

describe("assert-production-tool-execution (PR-014)", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("does not require sign-off when tool execution is disabled", () => {
    process.env.NODE_ENV = "production";
    delete process.env.TOOL_EXECUTION_ENABLED;
    const config = loadConfigFromEnv();
    expect(() => assertProductionToolExecution(config)).not.toThrow();
    expect(resolveToolExecutionEnabled(config)).toBe(false);
  });

  it("does not require sign-off in non-production", () => {
    process.env.NODE_ENV = "development";
    process.env.TOOL_EXECUTION_ENABLED = "true";
    delete process.env.TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF;
    const config = loadConfigFromEnv();
    expect(() => assertProductionToolExecution(config)).not.toThrow();
    expect(resolveToolExecutionEnabled(config)).toBe(true);
  });

  it("fails production bootstrap when tools enabled without security review sign-off", () => {
    process.env.NODE_ENV = "production";
    process.env.TOOL_EXECUTION_ENABLED = "true";
    process.env.SECURITY_HARD_CONTROLS_ENABLED = "true";
    delete process.env.TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF;
    const config = loadConfigFromEnv();
    expect(() => assertProductionToolExecution(config)).toThrow(
      /TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF=true/
    );
    expect(resolveToolExecutionEnabled(config)).toBe(false);
  });

  it("fails when security hard controls are off", () => {
    process.env.NODE_ENV = "production";
    process.env.TOOL_EXECUTION_ENABLED = "true";
    process.env.TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF = "true";
    process.env.TOOL_FILESYSTEM_ROOT = "/var/lib/ai-server/tools";
    process.env.SECURITY_HARD_CONTROLS_ENABLED = "false";
    const config = loadConfigFromEnv();
    expect(() => assertProductionToolExecution(config)).toThrow(
      /SECURITY_HARD_CONTROLS_ENABLED=true/
    );
  });

  it("fails when TOOL_FILESYSTEM_ROOT is unset", () => {
    process.env.NODE_ENV = "production";
    process.env.TOOL_EXECUTION_ENABLED = "true";
    process.env.TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF = "true";
    process.env.SECURITY_HARD_CONTROLS_ENABLED = "true";
    delete process.env.TOOL_FILESYSTEM_ROOT;
    const config = loadConfigFromEnv();
    expect(() => assertProductionToolExecution(config)).toThrow(/TOOL_FILESYSTEM_ROOT/);
  });

  it("passes when production tool execution is fully signed off", () => {
    process.env.NODE_ENV = "production";
    process.env.TOOL_EXECUTION_ENABLED = "true";
    process.env.TOOL_EXECUTION_SECURITY_REVIEW_SIGNOFF = "true";
    process.env.SECURITY_HARD_CONTROLS_ENABLED = "true";
    process.env.TOOL_FILESYSTEM_ROOT = "/var/lib/ai-server/tools";
    const config = loadConfigFromEnv();
    expect(() => assertProductionToolExecution(config)).not.toThrow();
    expect(resolveToolExecutionEnabled(config)).toBe(true);
    expect(isToolExecutionEnvFlagEnabled()).toBe(true);
    expect(isToolExecutionSecurityReviewSignoffAcknowledged()).toBe(true);
  });
});
