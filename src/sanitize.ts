import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { createSanitizer } from './sanitize-core.js';
import type { SanitizeOptions, SanitizeReport } from './types.js';

/** Low-level sanitizer. Callers must enforce their own input-size limit. */
export function sanitizeHtml(rawHtml: string, options: SanitizeOptions = {}): { html: string; report: SanitizeReport } {
  // A persistent jsdom Window retains DOMPurify's parsed documents through
  // jsdom's NodeIterator bookkeeping under repeated large inputs. Scope the
  // Window to one synchronous call and close it so the DOM can be reclaimed
  // after the current event-loop turn.
  const dom = new JSDOM('');
  try {
    return createSanitizer(dom.window, createDOMPurify)(rawHtml, options);
  } finally {
    dom.window.close();
  }
}
