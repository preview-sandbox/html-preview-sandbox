import { buildCsp, DEFAULT_SANDBOX_TOKENS, getSandboxAttribute } from './policy.js';
import type { PreviewOptions } from './types.js';

export type NormalizedSizing = { mode: 'fill' } | { mode: 'content'; minHeight: number; maxHeight: number };

function normalizeSizing(value: PreviewOptions['sizing']): NormalizedSizing {
  if (value === undefined) return { mode: 'fill' };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('sizing must be an options object');
  }
  if (value.mode === undefined || value.mode === 'fill') {
    if (value.minHeight !== undefined || value.maxHeight !== undefined) {
      throw new TypeError('minHeight and maxHeight require sizing.mode "content"');
    }
    return { mode: 'fill' };
  }
  if (value.mode !== 'content') throw new TypeError('sizing.mode must be "fill" or "content"');
  const { minHeight = 150, maxHeight = 10_000 } = value;
  if (
    !Number.isSafeInteger(minHeight) ||
    minHeight < 0 ||
    !Number.isSafeInteger(maxHeight) ||
    maxHeight <= 0 ||
    minHeight > maxHeight
  ) {
    throw new TypeError('Sizing bounds must be safe integers with 0 <= minHeight <= maxHeight and maxHeight > 0');
  }
  return { mode: 'content', minHeight, maxHeight };
}

function allowsInlineBridge(csp: string): boolean {
  return csp.split(',').every((policy) => {
    const directives = new Map<string, string[]>();
    for (const directive of policy.split(';')) {
      const [name, ...sources] = directive
        .trim()
        .toLowerCase()
        .split(/[\t\n\f\r ]+/);
      if (name && !directives.has(name)) directives.set(name, sources);
    }
    const fallback = directives.get('script-src') ?? directives.get('default-src');
    const element = directives.get('script-src-elem') ?? fallback;
    // Older supported engines also need the script-src fallback to allow the bridge.
    return [element, fallback].every(
      (sources) =>
        !sources ||
        (sources.includes("'unsafe-inline'") &&
          !sources.some((source) => /^'(?:nonce-|sha(?:256|384|512)-|strict-dynamic'$)/.test(source))),
    );
  });
}

export function validatePreviewSizing(options: PreviewOptions, csp?: string): NormalizedSizing {
  const sizing = normalizeSizing(options.sizing);
  if (sizing.mode === 'content') {
    const tokens = getSandboxAttribute(options.sandboxTokens ?? DEFAULT_SANDBOX_TOKENS, {
      allowUnsafeTokens: options.allowUnsafeSandboxTokens,
    })
      .toLowerCase()
      .split(/[\t\n\f\r ]+/);
    if (!tokens.includes('allow-scripts'))
      throw new TypeError('Content sizing requires the allow-scripts sandbox token');
    if (!allowsInlineBridge(csp ?? buildCsp(options.csp))) {
      throw new TypeError('Content sizing requires CSP to allow the injected inline bridge');
    }
  }
  return sizing;
}
