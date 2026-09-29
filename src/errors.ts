import type { PreviewErrorCode } from './types.js';

export class PreviewError extends Error {
  code: PreviewErrorCode;
  cause?: unknown;
  actualBytes?: number;
  maxBytes?: number;

  constructor(
    code: PreviewErrorCode,
    message: string,
    cause?: unknown,
    details: { actualBytes?: number; maxBytes?: number } = {},
  ) {
    super(message);
    this.name = 'PreviewError';
    this.code = code;
    this.cause = cause;
    this.actualBytes = details.actualBytes;
    this.maxBytes = details.maxBytes;
  }
}

export const ERROR_CODES = {
  OVERSIZED: 'OVERSIZED',
  DECODE_FAILED: 'DECODE_FAILED',
  EMPTY_AFTER_SANITIZE: 'EMPTY_AFTER_SANITIZE',
  RENDER_FAILED: 'RENDER_FAILED',
} as const satisfies Record<string, PreviewErrorCode>;
