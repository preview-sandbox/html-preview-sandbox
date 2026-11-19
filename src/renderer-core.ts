import { BRIDGE_CONTENT_SIZE, BRIDGE_CSP_VIOLATION, BRIDGE_OPEN_EXTERNAL } from './bridge.js';
import { DEFAULT_SANDBOX_TOKENS, getSandboxAttribute, isAllowedExternalUrl } from './policy.js';
import { ERROR_CODES, PreviewError } from './errors.js';
import { validatePreviewSizing } from './sizing.js';
import type { NormalizedSizing } from './sizing.js';
import type {
  OpenExternalSource,
  PreviewErrorShape,
  PreviewFrameSize,
  PreviewHandle,
  PreviewInput,
  PreviewOptions,
  RenderResult,
} from './types.js';

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toPreviewError(error: unknown): PreviewErrorShape {
  return error instanceof PreviewError ? error : new PreviewError(ERROR_CODES.RENDER_FAILED, toMessage(error), error);
}

type OpenExternalContext = { source: OpenExternalSource };
type CreateHtmlDocument = (input: PreviewInput, options?: PreviewOptions) => Promise<RenderResult>;
type FramePolicy = { sizing: NormalizedSizing; sandbox: string };

function sandboxAttribute(options: PreviewOptions): string {
  return getSandboxAttribute(options.sandboxTokens ?? DEFAULT_SANDBOX_TOKENS, {
    allowUnsafeTokens: options.allowUnsafeSandboxTokens,
  });
}

function framePolicy(options: PreviewOptions): FramePolicy {
  return {
    sizing: validatePreviewSizing(options),
    sandbox: sandboxAttribute(options),
  };
}

// The Node and browser entrypoints share this renderer; they only differ in
// which createHtmlDocument implementation (jsdom-backed vs real DOM) they inject.
export function createPreviewFactory(createHtmlDocument: CreateHtmlDocument) {
  return function createPreview(container: HTMLElement, options: PreviewOptions = {}): PreviewHandle {
    if (!container || typeof container.appendChild !== 'function') {
      throw new TypeError('createPreview requires a container HTMLElement');
    }

    let currentOptions = { ...options };
    validatePreviewSizing(currentOptions);
    const document = container.ownerDocument;
    const hostWindow = document.defaultView ?? window;
    let iframe: HTMLIFrameElement | null = null;
    let destroyed = false;
    let lastRender: { html: string; sizing: NormalizedSizing } | undefined;
    let renderGeneration = 0;
    let sizing: NormalizedSizing = { mode: 'fill' };
    let heightUpdate: number | undefined;
    let pendingHeight = 0;
    let appliedHeight = 0;
    let resizeObserver: ResizeObserver | undefined;

    function observeFrame(): void {
      resizeObserver?.disconnect();
      resizeObserver = undefined;
      const frame = iframe;
      const callback = currentOptions.onFrameResize;
      if (!frame || !callback || typeof hostWindow.ResizeObserver !== 'function') return;

      let lastSize: PreviewFrameSize | undefined;
      const observer = new hostWindow.ResizeObserver(([entry]) => {
        if (!entry || iframe !== frame || resizeObserver !== observer) return;
        const box = entry.borderBoxSize?.[0];
        const vertical = box && /^(vertical|sideways)-/.test(hostWindow.getComputedStyle(frame).writingMode);
        const { width, height } = box
          ? { width: vertical ? box.blockSize : box.inlineSize, height: vertical ? box.inlineSize : box.blockSize }
          : frame.getBoundingClientRect();
        if (lastSize?.width === width && lastSize.height === height) return;
        lastSize = { width, height };
        callback({ width, height });
      });
      resizeObserver = observer;
      observer.observe(frame, { box: 'border-box' });
    }

    function removeIframe(): void {
      resizeObserver?.disconnect();
      resizeObserver = undefined;
      if (heightUpdate !== undefined) hostWindow.cancelAnimationFrame(heightUpdate);
      heightUpdate = undefined;
      if (iframe?.parentNode) iframe.parentNode.removeChild(iframe);
      iframe = null;
    }

    function ensureIframe(policy: FramePolicy, initialHeight?: number): HTMLIFrameElement {
      removeIframe();
      sizing = policy.sizing;
      iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', policy.sandbox);
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      iframe.setAttribute('title', 'HTML preview sandbox');
      iframe.style.width = '100%';
      if (sizing.mode === 'content') {
        appliedHeight = initialHeight ?? sizing.minHeight;
        iframe.style.height = `${appliedHeight}px`;
        iframe.style.minHeight = `${sizing.minHeight}px`;
        iframe.style.maxHeight = `${sizing.maxHeight}px`;
      } else {
        iframe.style.height = '100%';
      }
      iframe.style.border = '0';
      iframe.style.display = 'block';
      iframe.style.background = '#fff';
      container.appendChild(iframe);
      observeFrame();
      return iframe;
    }

    function updateFrameHeight(frame: HTMLIFrameElement, height: unknown): void {
      if (sizing.mode !== 'content' || typeof height !== 'number' || !Number.isFinite(height) || height < 0) return;
      pendingHeight = Math.max(sizing.minHeight, Math.min(sizing.maxHeight, Math.ceil(height)));
      if (heightUpdate !== undefined || pendingHeight === appliedHeight) return;
      heightUpdate = hostWindow.requestAnimationFrame(() => {
        heightUpdate = undefined;
        if (iframe !== frame || !frame.isConnected || appliedHeight === pendingHeight) return;
        appliedHeight = pendingHeight;
        frame.style.height = `${appliedHeight}px`;
      });
    }

    function handleMessage(event: MessageEvent): void {
      const data = event?.data;
      if (!data || typeof data !== 'object') return;
      const frameWindow = iframe?.contentWindow;
      if (!iframe || !frameWindow || event.source !== frameWindow) return;

      if ('type' in data && data.type === BRIDGE_CONTENT_SIZE) {
        if ('height' in data) updateFrameHeight(iframe, data.height);
        return;
      }

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
        currentOptions.logger?.warn?.(`External URL policy threw: ${toMessage(error)}`);
        return false;
      }
    }

    function remountLastHtml(): void {
      if (!lastRender || destroyed) return;
      const target = ensureIframe(
        { sizing: lastRender.sizing, sandbox: sandboxAttribute(currentOptions) },
        appliedHeight,
      );
      target.srcdoc = lastRender.html;
    }

    hostWindow.addEventListener('message', handleMessage);

    return {
      async render(input) {
        if (destroyed) throw new Error('Preview has been destroyed');
        const generation = ++renderGeneration;
        try {
          const options = currentOptions;
          const policy = framePolicy(options);
          const result = await createHtmlDocument(input, options);
          if (destroyed || generation !== renderGeneration) return result;
          currentOptions.onSanitize?.(result.sanitizeReport);
          if (destroyed || generation !== renderGeneration) return result;
          lastRender = { html: result.html, sizing: policy.sizing };
          const target = ensureIframe(policy);
          target.srcdoc = result.html;
          return result;
        } catch (error) {
          currentOptions.onError?.(toPreviewError(error));
          throw error;
        }
      },
      updateOptions(patch) {
        const options = { ...currentOptions, ...patch };
        validatePreviewSizing(options);
        const callbackChanged = options.onFrameResize !== currentOptions.onFrameResize;
        currentOptions = options;
        if (callbackChanged) observeFrame();
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
        renderGeneration += 1;
        hostWindow.removeEventListener('message', handleMessage);
        removeIframe();
        lastRender = undefined;
      },
      get iframe() {
        return iframe;
      },
    };
  };
}
