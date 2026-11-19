export const BRIDGE_OPEN_EXTERNAL = 'html-preview-sandbox:openExternal';
export const BRIDGE_CSP_VIOLATION = 'html-preview-sandbox:cspViolation';
export const BRIDGE_CONTENT_SIZE = 'html-preview-sandbox:contentSize';

const CSP_VIOLATION_LIMIT = 30;

const CONTENT_SIZING = `
  if (document.currentScript?.getAttribute('data-html-preview-sandbox-sizing') === 'content') {
    function observeContent() {
      const feedback = [];
      let frame = null;
      let timer = null;
      let lastHeight;
      let measuredOverflow = false;
      let observedBody;
      let previousWidth;
      let previousViewport;
      let dirty = true;
      let settled = false;
      let direction = 0;
      let reversals = 0;
      const fonts = document.fonts;
      const boxObserver = new ResizeObserver(schedule);
      const mutations = new MutationObserver(invalidate);

      function measure() {
        clearPending();
        const body = document.body;
        const root = document.documentElement;
        if (!body || !root) return;
        if (body !== observedBody) {
          boxObserver.disconnect();
          boxObserver.observe(body, { box: 'border-box' });
          observedBody = body;
        }
        const width = window.innerWidth;
        const viewport = root.clientHeight;
        if (dirty || width !== previousWidth) settled = false;
        if (dirty || width !== previousWidth || (!settled && viewport === previousViewport)) {
          feedback.length = 0;
          direction = 0;
          reversals = 0;
        }
        dirty = false;
        previousWidth = width;
        previousViewport = viewport;
        if (settled) return;

        let height = contentHeight(body, root, viewport);
        if (height === lastHeight) return;
        // Only stop oscillation: monotonic changes (such as expanding content) still finish normally.
        const nextDirection = Math.sign(height - (lastHeight ?? height));
        if (direction && nextDirection !== direction) reversals++;
        direction = nextDirection;
        if (feedback.includes(height) || reversals >= 4) {
          height = Math.max(height, lastHeight ?? 0, ...feedback);
          settled = true;
          if (height === lastHeight) return;
        } else {
          if (feedback.length === 8) feedback.shift();
          feedback.push(height);
        }
        lastHeight = height;
        post(${JSON.stringify(BRIDGE_CONTENT_SIZE)}, { height });
      }

      function contentHeight(body, root, viewport) {
        const rect = body.getBoundingClientRect();
        if (rect.height === 0 && !body.firstElementChild && !body.textContent.trim()) {
          measuredOverflow = false;
          return 0;
        }
        const style = getComputedStyle(body);
        // The root box includes collapsed child margins without the viewport's minimum scroll extent.
        const margins = rect.height > 0
          ? (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0)
          : 0;
        let height = Math.max(0, Math.ceil(root.getBoundingClientRect().height), Math.ceil(rect.height + margins));
        const extent = root.scrollHeight;
        if (extent > Math.max(viewport, height)) {
          measuredOverflow = true;
          return extent;
        }
        if (measuredOverflow && extent === viewport && height < extent) {
          // Equality can hide positioned overflow. Do not measure collapsed normal-flow content.
          const bottom = Math.min(extent, positionedBottom(body, height, extent));
          measuredOverflow = bottom > height;
          height = bottom;
        } else {
          measuredOverflow = false;
        }
        return height;
      }

      function positionedBottom(body, height, limit) {
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, {
          acceptNode(node) {
            const parent = node.parentElement;
            return parent?.localName === 'details' && !parent.open && node.localName !== 'summary'
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT;
          }
        });
        const offset = Math.max(0, window.scrollY);
        for (let node = walker.nextNode(); node && height < limit; node = walker.nextNode()) {
          const style = getComputedStyle(node);
          if (style.position !== 'absolute') continue;
          const box = node.getBoundingClientRect();
          if (!box.width && !box.height) continue;
          height = Math.max(height, Math.ceil(box.bottom + offset + (parseFloat(style.marginBottom) || 0)));
        }
        return height;
      }

      function clearPending() {
        if (frame !== null) cancelAnimationFrame(frame);
        if (timer !== null) clearTimeout(timer);
        frame = timer = null;
      }

      function schedule() {
        if (frame !== null) return;
        frame = requestAnimationFrame(measure);
        // Some engines suspend rAF for empty or offscreen frames.
        timer = setTimeout(measure, 100);
      }

      function invalidate() {
        dirty = true;
        schedule();
      }

      mutations.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      document.addEventListener('load', invalidate, true);
      fonts?.addEventListener('loadingdone', invalidate);
      window.addEventListener('resize', schedule);
      window.addEventListener('pagehide', function stop(event) {
        if (event.persisted) return;
        boxObserver.disconnect();
        mutations.disconnect();
        clearPending();
        document.removeEventListener('load', invalidate, true);
        fonts?.removeEventListener('loadingdone', invalidate);
        window.removeEventListener('resize', schedule);
        window.removeEventListener('pagehide', stop);
      });
      measure();
    }
    document.addEventListener('DOMContentLoaded', observeContent, { once: true });
  }
`;

function bridgeScript(content: boolean): string {
  return `<script${content ? ' data-html-preview-sandbox-sizing="content"' : ''}>
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
  });${content ? CONTENT_SIZING : ''}
})();
</script>`;
}

export function injectBridgeScript(html: string): string {
  return injectPreviewBridge(html, false);
}

export function injectPreviewBridge(html: string, content: boolean): string {
  const script = bridgeScript(content);
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
