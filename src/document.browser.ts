import { normalizeInput } from './decode.js';
import { sanitizeHtml } from './sanitize.browser.js';
import { buildCsp, injectCspMeta } from './policy.js';
import { injectPreviewBridge } from './bridge.js';
import { injectPreviewScrollbarStyle } from './scrollbar.js';
import { validatePreviewSizing } from './sizing.js';
import type { PreviewInput, PreviewOptions, RenderResult } from './types.js';

export async function createHtmlDocument(input: PreviewInput, options: PreviewOptions = {}): Promise<RenderResult> {
  const csp = buildCsp(options.csp);
  const content = validatePreviewSizing(options, csp).mode === 'content';
  const decoded = await normalizeInput(input, { maxBytes: options.maxBytes });
  const sanitized = sanitizeHtml(decoded.html, options.sanitize);

  const withCsp = injectCspMeta(sanitized.html, csp);
  const withBridge = injectPreviewBridge(withCsp, content);
  const html = options.injectScrollbarStyle === false ? withBridge : injectPreviewScrollbarStyle(withBridge, content);

  return {
    html,
    encoding: decoded.encoding,
    size: decoded.size,
    sanitizeReport: sanitized.report,
  };
}
