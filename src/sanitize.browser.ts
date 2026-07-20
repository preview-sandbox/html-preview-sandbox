import createDOMPurify from 'dompurify';
import { createSanitizer } from './sanitize-core.js';
import type { SanitizeOptions, SanitizeReport } from './types.js';

// Created on first use rather than at module scope: importing this entry on a
// server (SSR, Node tooling) must not touch `window` — only calling it does.
let sanitizer: ReturnType<typeof createSanitizer> | undefined;

export function sanitizeHtml(rawHtml: string, options: SanitizeOptions = {}): { html: string; report: SanitizeReport } {
  sanitizer ??= createSanitizer(window, createDOMPurify);
  return sanitizer(rawHtml, options);
}
