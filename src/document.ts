import { normalizeInput } from './decode.js';
import { sanitizeHtml } from './sanitize.js';
import { buildCsp, injectCspMeta } from './policy.js';
import { injectBridgeScript } from './bridge.js';
import { injectScrollbarStyle } from './scrollbar.js';
import { ERROR_CODES, PreviewError } from './errors.js';
import type { PreviewInput, PreviewOptions, RenderResult } from './types.js';

export async function createHtmlDocument(input: PreviewInput, options: PreviewOptions = {}): Promise<RenderResult> {
  const decoded = await normalizeInput(input, { maxBytes: options.maxBytes });
  const sanitized = sanitizeHtml(decoded.html, options.sanitize);

  if (!sanitized.html.trim()) {
    sanitized.report.strippedAll = true;
    throw new PreviewError(ERROR_CODES.EMPTY_AFTER_SANITIZE, 'HTML is empty after sanitization');
  }

  const csp = buildCsp(options.csp);
  const withCsp = injectCspMeta(sanitized.html, csp);
  const withBridge = injectBridgeScript(withCsp);
  const html = options.injectScrollbarStyle === false ? withBridge : injectScrollbarStyle(withBridge);

  return {
    html,
    encoding: decoded.encoding,
    sanitizeReport: sanitized.report,
  };
}
