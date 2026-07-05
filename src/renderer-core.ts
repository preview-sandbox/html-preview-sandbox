import { BRIDGE_CSP_VIOLATION, BRIDGE_OPEN_EXTERNAL } from './bridge.js';
import { DEFAULT_SANDBOX_TOKENS, getSandboxAttribute, isAllowedExternalUrl } from './policy.js';
import type { OpenExternalSource, PreviewHandle, PreviewInput, PreviewOptions, RenderResult } from './types.js';

type OpenExternalContext = { source: OpenExternalSource };
type CreateHtmlDocument = (input: PreviewInput, options?: PreviewOptions) => Promise<RenderResult>;

// The Node and browser entrypoints share this renderer; they only differ in
// which createHtmlDocument implementation (jsdom-backed vs real DOM) they inject.
export function createPreviewFactory(createHtmlDocument: CreateHtmlDocument) {
  return function createPreview(container: HTMLElement, options: PreviewOptions = {}): PreviewHandle {
    if (!container || typeof container.appendChild !== 'function') {
      throw new TypeError('createPreview requires a container HTMLElement');
    }

    let currentOptions = { ...options };
    let iframe: HTMLIFrameElement | null = null;
    let destroyed = false;
    let lastHtml = '';

    function removeIframe(): void {
      if (iframe?.parentNode) iframe.parentNode.removeChild(iframe);
      iframe = null;
    }

    function ensureIframe(): HTMLIFrameElement {
      removeIframe();
      iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', getSandboxAttribute(currentOptions.sandboxTokens ?? DEFAULT_SANDBOX_TOKENS, {
        allowUnsafeTokens: currentOptions.allowUnsafeSandboxTokens,
      }));
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      iframe.setAttribute('title', 'HTML preview sandbox');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = '0';
      iframe.style.display = 'block';
      iframe.style.background = '#fff';
      container.appendChild(iframe);
      return iframe;
    }

    function handleMessage(event: MessageEvent): void {
      const data = event?.data;
      if (!data || typeof data !== 'object') return;
      if (!iframe || event.source !== iframe.contentWindow) return;

      if ('type' in data && data.type === BRIDGE_CSP_VIOLATION) {
        currentOptions.onCspViolation?.({
          effectiveDirective: String(data.effectiveDirective || data.violatedDirective || ''),
          blockedURI: String(data.blockedURI || ''),
          sourceFile: String(data.sourceFile || ''),
          lineNumber: Number(data.lineNumber || 0),
          sample: String(data.sample || ''),
        });
        return;
      }

      if ('type' in data && data.type === BRIDGE_OPEN_EXTERNAL) {
        const href = String(data.href || '');
        const source: OpenExternalSource = data.source === 'window.open' ? 'window.open' : 'link';
        const context: OpenExternalContext = { source };
        if (!isAllowedExternal(href, context)) {
          currentOptions.logger?.warn?.(`Blocked external URL: ${href}`);
          return;
        }
        currentOptions.onOpenExternal?.(href, context);
      }
    }

    function isAllowedExternal(url: string, context: OpenExternalContext): boolean {
      if (!isAllowedExternalUrl(url, currentOptions.externalProtocols)) return false;
      if (!currentOptions.allowExternalUrl) return true;
      try {
        return currentOptions.allowExternalUrl(url, context) === true;
      } catch (error) {
        currentOptions.logger?.warn?.(`External URL policy threw: ${error?.message || error}`);
        return false;
      }
    }

    function remountLastHtml(): void {
      if (!lastHtml) return;
      const target = ensureIframe();
      target.srcdoc = lastHtml;
    }

    window.addEventListener('message', handleMessage);

    return {
      async render(input) {
        if (destroyed) throw new Error('Preview has been destroyed');
        try {
          const result = await createHtmlDocument(input, currentOptions);
          currentOptions.onSanitize?.(result.sanitizeReport);
          lastHtml = result.html;
          const target = ensureIframe();
          target.srcdoc = result.html;
          return result;
        } catch (error) {
          currentOptions.onError?.(error);
          throw error;
        }
      },
      updateOptions(patch) {
        currentOptions = { ...currentOptions, ...patch };
      },
      notifyNavigationAttempt(url, context = { source: 'navigation' as const }) {
        const href = String(url || '');
        if (!href) return;
        currentOptions.onNavigationAttempt?.(href, context);
        remountLastHtml();
        if (isAllowedExternal(href, context)) {
          currentOptions.onOpenExternal?.(href, context);
        } else {
          currentOptions.logger?.warn?.(`Blocked navigation URL: ${href}`);
        }
      },
      destroy() {
        destroyed = true;
        window.removeEventListener('message', handleMessage);
        removeIframe();
        lastHtml = '';
      },
      get iframe() {
        return iframe;
      },
    };
  };
}
