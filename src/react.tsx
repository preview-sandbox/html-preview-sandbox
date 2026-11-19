import { forwardRef, useEffect, useRef } from 'react';
import type { CSSProperties, ForwardedRef } from 'react';
import { createPreview } from './index.browser.js';
import { ERROR_CODES, PreviewError } from './errors.js';
import type { PreviewErrorShape, PreviewHandle, PreviewInput, PreviewOptions } from './types.js';

export type {
  CspPolicy,
  CspPreset,
  CspViolationReport,
  OpenExternalSource,
  PreviewErrorShape,
  PreviewFrameSize,
  PreviewHandle,
  PreviewInput,
  PreviewOptions,
  PreviewSizingOptions,
  RenderResult,
  SanitizeOptions,
  SanitizeReport,
} from './types.js';

export interface SafeHtmlPreviewProps extends PreviewOptions {
  /** HTML to render through the sandbox pipeline. */
  source?: PreviewInput;
  className?: string;
  style?: CSSProperties;
}

function assignRef(ref: ForwardedRef<PreviewHandle | null>, value: PreviewHandle | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function reportError(options: PreviewOptions, error: PreviewErrorShape): void {
  if (options.onError) options.onError(error);
  else (options.logger ?? console).error('html-preview-sandbox render failed:', error);
}

export const SafeHtmlPreview = forwardRef<PreviewHandle | null, SafeHtmlPreviewProps>(function SafeHtmlPreview(
  { source, className, style, ...options },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<PreviewHandle | null>(null);
  // Latest options, read by the stable delegating callbacks below — callback
  // props can change every render without recreating the preview (or iframe).
  const optionsRef = useRef<PreviewOptions>(options);
  optionsRef.current = options;
  const observeFrame = options.onFrameResize !== undefined;
  const resizeDelegate = useRef<NonNullable<PreviewOptions['onFrameResize']>>((size) => {
    optionsRef.current.onFrameResize?.(size);
  });
  // Serializes render() calls so a slow earlier render can't overwrite a later one.
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const handle = createPreview(container, {
      ...optionsRef.current,
      sizing: undefined,
      onFrameResize: optionsRef.current.onFrameResize ? resizeDelegate.current : undefined,
      allowExternalUrl: (url, context) =>
        optionsRef.current.allowExternalUrl ? optionsRef.current.allowExternalUrl(url, context) : true,
      onOpenExternal: (url, context) => optionsRef.current.onOpenExternal?.(url, context),
      onCspViolation: (report) => optionsRef.current.onCspViolation?.(report),
      onSanitize: (report) => optionsRef.current.onSanitize?.(report),
      onNavigationAttempt: (url, context) => optionsRef.current.onNavigationAttempt?.(url, context),
      onError: (error) => reportError(optionsRef.current, error),
      logger: {
        info: (...args) => optionsRef.current.logger?.info(...args),
        warn: (...args) => optionsRef.current.logger?.warn(...args),
        error: (...args) => optionsRef.current.logger?.error(...args),
      },
    });
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.destroy();
    };
  }, []);

  useEffect(() => {
    assignRef(ref, handleRef.current);
    return () => assignRef(ref, null);
  }, [ref]);

  useEffect(() => {
    handleRef.current?.updateOptions({ onFrameResize: observeFrame ? resizeDelegate.current : undefined });
  }, [observeFrame]);

  // Policy props change the produced document, so they need updateOptions plus
  // a re-render of the current source. Serialized so inline literals in JSX
  // don't retrigger the effect on every render.
  const policyKey = JSON.stringify([
    options.csp,
    options.sanitize,
    options.maxBytes,
    options.sandboxTokens,
    options.allowUnsafeSandboxTokens,
    options.injectScrollbarStyle,
    options.externalProtocols,
    options.sizing,
  ]);

  // policyKey isn't read inside the effect — it exists purely so inline object
  // literals in JSX retrigger this effect only when their *contents* change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: policyKey is the serialized form of the options read via optionsRef
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    const {
      csp,
      sanitize,
      maxBytes,
      sandboxTokens,
      allowUnsafeSandboxTokens,
      injectScrollbarStyle,
      externalProtocols,
      sizing,
    } = optionsRef.current;
    try {
      handle.updateOptions({
        csp,
        sanitize,
        maxBytes,
        sandboxTokens,
        allowUnsafeSandboxTokens,
        injectScrollbarStyle,
        externalProtocols,
        sizing,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reportError(optionsRef.current, new PreviewError(ERROR_CODES.RENDER_FAILED, message, error));
      return;
    }
    if (source === undefined) return;
    let active = true;
    chainRef.current = chainRef.current
      .then(() => {
        if (active && handleRef.current === handle) return handle.render(source);
      })
      // Rejections are already surfaced through the onError wrapper above.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [source, policyKey]);

  return <div ref={containerRef} className={className} style={style} />;
});
