export const BRIDGE_OPEN_EXTERNAL = 'html-preview-sandbox:openExternal';
export const BRIDGE_CSP_VIOLATION = 'html-preview-sandbox:cspViolation';

const CSP_VIOLATION_LIMIT = 30;

function bridgeScript(): string {
  return `<script>
(() => {
  const OPEN_EXTERNAL = ${JSON.stringify(BRIDGE_OPEN_EXTERNAL)};
  const CSP_VIOLATION = ${JSON.stringify(BRIDGE_CSP_VIOLATION)};
  const LIMIT = ${CSP_VIOLATION_LIMIT};

  function post(type, payload) {
    try {
      window.parent.postMessage(Object.assign({ type }, payload), '*');
    } catch (_) {}
  }

  function postExternal(href, source) {
    post(OPEN_EXTERNAL, { href: String(href || ''), source });
  }

  document.addEventListener('click', (event) => {
    let element = event.target;
    while (element && element.nodeName !== 'A') element = element.parentElement;
    if (!element) return;

    const href = element.getAttribute('href');
    const resolved = element.href || '';

    if (href == null || href === '' || href.charAt(0) === '#') {
      event.preventDefault();
      event.stopPropagation();
      const fragment = href && href.length > 1 ? href.slice(1) : '';
      if (fragment) {
        let target = null;
        try {
          target = document.getElementById(fragment) || document.querySelector('a[name="' + CSS.escape(fragment) + '"]');
        } catch (_) {}
        if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (href === '#') {
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
      }
      return;
    }

    // Defense in depth: even if a relaxed custom sanitizer let a javascript: URL
    // through, the bridge must not allow the default click to run it.
    if (/^javascript:/i.test(resolved)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    try {
      const url = new URL(resolved);
      if (url.protocol === 'about:') return;
    } catch (_) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    postExternal(resolved, 'link');
  }, true);

  window.open = (url) => {
    if (url) postExternal(url, 'window.open');
    return null;
  };

  const seen = new Set();
  let sent = 0;
  document.addEventListener('securitypolicyviolation', (event) => {
    if (sent >= LIMIT) return;
    const key = (event.effectiveDirective || event.violatedDirective || '') + '|' + (event.blockedURI || '');
    if (seen.has(key)) return;
    seen.add(key);
    sent += 1;
    post(CSP_VIOLATION, {
      blockedURI: String(event.blockedURI || ''),
      violatedDirective: String(event.violatedDirective || ''),
      effectiveDirective: String(event.effectiveDirective || ''),
      sourceFile: String(event.sourceFile || ''),
      lineNumber: Number(event.lineNumber || 0),
      columnNumber: Number(event.columnNumber || 0),
      disposition: String(event.disposition || ''),
      sample: String(event.sample || '').slice(0, 120),
    });
  });
})();
</script>`;
}

export function injectBridgeScript(html: string): string {
  const script = bridgeScript();
  const cspMeta = /<meta[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/i;

  if (cspMeta.test(html)) {
    return html.replace(cspMeta, (match: string) => `${match}${script}`);
  }

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${script}</head>`);
  }

  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (match: string) => `${match}${script}`);
  }

  return `${html}${script}`;
}
