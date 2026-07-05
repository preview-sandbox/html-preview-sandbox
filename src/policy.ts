import type { CspPolicy, CspPreset } from './types.js';

const DEFAULT_SCRIPT_HOSTS = [
  'https://cdnjs.cloudflare.com',
  'https://cdn.jsdelivr.net',
  'https://cdn.tailwindcss.com',
  'https://code.jquery.com',
];

const DEFAULT_STYLE_HOSTS = [
  'https://cdnjs.cloudflare.com',
  'https://cdn.jsdelivr.net',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com',
];

const DEFAULT_FONT_HOSTS = ['https://fonts.gstatic.com'];

export const DEFAULT_SANDBOX_TOKENS = [
  'allow-scripts',
  'allow-forms',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-modals',
];

export const UNSAFE_SANDBOX_TOKENS = [
  'allow-same-origin',
  'allow-top-navigation',
  'allow-top-navigation-by-user-activation',
  'allow-downloads',
];

export const DEFAULT_ALLOWED_EXTERNAL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

function normalizePolicy(policy?: CspPreset | CspPolicy): CspPolicy {
  if (!policy) return { preset: 'strict' };
  if (typeof policy === 'string') return { preset: policy };
  return { preset: 'strict', ...policy };
}

function join(values: string[]): string {
  return [...new Set(values.filter(Boolean))].join(' ');
}

// Presets are layered by exfiltration capability (egress), not resource loading (ingress):
//   offline  — no network at all, nothing in or out.
//   strict   — default. Blocks attacker-readable exfiltration channels (connect-src 'none',
//              form-action 'none', no wildcard img/media hosts). Fixed static CDN/font hosts
//              may be loaded; inline script and 'unsafe-eval' are permitted because they add
//              no attacker capability beyond already-permitted inline scripts and provide no
//              attacker-readable exfiltration sink.
//   balanced — compatibility-first. Opens https: images/media and connect-src https:,
//              which IS a general-purpose exfiltration surface; for semi-trusted content only.
export function buildCsp(policy?: CspPreset | CspPolicy): string {
  const normalized = normalizePolicy(policy);
  const preset = normalized.preset ?? 'strict';

  const scriptHosts = [...DEFAULT_SCRIPT_HOSTS, ...(normalized.scriptHosts ?? [])];
  const styleHosts = [...DEFAULT_STYLE_HOSTS, ...(normalized.styleHosts ?? [])];
  const fontHosts = [...DEFAULT_FONT_HOSTS, ...(normalized.fontHosts ?? [])];
  const imgHosts = normalized.imgHosts ?? [];
  const connectHosts = normalized.connectHosts ?? [];

  const directives: Record<string, string> = {
    'default-src': "'none'",
    'script-src': join(["'unsafe-inline'", "'unsafe-eval'", ...scriptHosts]),
    'style-src': join(["'unsafe-inline'", ...styleHosts]),
    'img-src': join(['blob:', 'data:', ...imgHosts]),
    'media-src': 'blob: data:',
    'font-src': join(['data:', ...fontHosts]),
    'connect-src': "'none'",
    'worker-src': "'none'",
    'frame-src': 'blob:',
    'object-src': "'none'",
    'base-uri': "'none'",
    'form-action': "'none'",
    'upgrade-insecure-requests': '',
    'block-all-mixed-content': '',
  };

  if (preset === 'balanced') {
    directives['script-src'] = join(["'unsafe-inline'", "'unsafe-eval'", ...scriptHosts, 'https://unpkg.com']);
    directives['style-src'] = join(["'unsafe-inline'", ...styleHosts, 'https://unpkg.com']);
    directives['img-src'] = join(['https:', 'blob:', 'data:', ...imgHosts]);
    directives['media-src'] = join(['https:', 'blob:', 'data:']);
    directives['connect-src'] = connectHosts.length ? join(['https:', ...connectHosts]) : 'https:';
  }

  if (preset === 'offline') {
    directives['script-src'] = "'unsafe-inline'";
    directives['style-src'] = "'unsafe-inline'";
    directives['img-src'] = 'blob: data:';
    directives['media-src'] = 'blob: data:';
    directives['font-src'] = 'data:';
    directives['connect-src'] = "'none'";
  }

  Object.assign(directives, normalized.directives ?? {});

  return Object.entries(directives)
    .map(([name, value]) => (value ? `${name} ${value}` : name))
    .join('; ');
}

export function injectCspMeta(html: string, csp: string): string {
  const escaped = csp.replace(/"/g, '&quot;');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${escaped}">`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match: string) => `${match}${meta}`);
  }

  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match: string) => `${match}<head>${meta}</head>`);
  }

  return `<!doctype html><html><head>${meta}</head><body>${html}</body></html>`;
}

export function getSandboxAttribute(tokens = DEFAULT_SANDBOX_TOKENS, options: { allowUnsafeTokens?: boolean } = {}): string {
  const allowUnsafeTokens = options.allowUnsafeTokens === true;
  return [...new Set(tokens)]
    .filter((token) => allowUnsafeTokens || !UNSAFE_SANDBOX_TOKENS.includes(token))
    .join(' ');
}

export function isAllowedExternalUrl(url: string, protocols = DEFAULT_ALLOWED_EXTERNAL_PROTOCOLS): boolean {
  try {
    const parsed = new URL(url);
    const allowedProtocols = protocols.map((protocol) => {
      const normalized = String(protocol || '').toLowerCase();
      return normalized.endsWith(':') ? normalized : `${normalized}:`;
    });
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}
