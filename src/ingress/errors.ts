/**
 * Ingress rejection type – deterministic failure with taxonomy code.
 * @see Docs/SPEC/02_API_Contracts.md (Error Taxonomy)
 */

import type { ErrorCode } from "../contracts/errors.js";

export interface IngressRejection {
  code: ErrorCode;
  message: string;
  detail?: Record<string, unknown>;
  httpStatus: number;
  retryable: boolean;
}
