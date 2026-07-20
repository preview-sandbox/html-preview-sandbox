import { forwardRef, useEffect, useRef } from 'react';
import type { CSSProperties, ForwardedRef } from 'react';
import { createPreview } from './index.browser.js';
import type { PreviewHandle, PreviewInput, PreviewOptions } from './types.js';

export type {
  CspPolicy,
  CspPreset,
  CspViolationReport,
  OpenExternalSource,
  PreviewErrorShape,
  PreviewHandle,
  PreviewInput,
  PreviewOptions,
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
  // Serializes render() calls so a slow earlier render can't overwrite a later one.
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());

  // The forwarded ref is stable for a component instance; recreating the
  // preview on ref identity change would throw away the iframe for nothing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-once by design
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const handle = createPreview(container, {
      ...optionsRef.current,
      allowExternalUrl: (url, context) =>
        optionsRef.current.allowExternalUrl ? optionsRef.current.allowExternalUrl(url, context) : true,
      onOpenExternal: (url, context) => optionsRef.current.onOpenExternal?.(url, context),
      onCspViolation: (report) => optionsRef.current.onCspViolation?.(report),
      onSanitize: (report) => optionsRef.current.onSanitize?.(report),
      onNavigationAttempt: (url, context) => optionsRef.current.onNavigationAttempt?.(url, context),
      onError: (error) => {
        if (optionsRef.current.onError) optionsRef.current.onError(error);
        else (optionsRef.current.logger ?? console).error('html-preview-sandbox render failed:', error);
      },
    });
    handleRef.current = handle;
    assignRef(ref, handle);
    return () => {
      assignRef(ref, null);
      handleRef.current = null;
      handle.destroy();
    };
  }, []);

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
  ]);

  // policyKey isn't read inside the effect — it exists purely so inline object
  // literals in JSX retrigger this effect only when their *contents* change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: policyKey is the serialized form of the options read via optionsRef
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.updateOptions({
      csp: optionsRef.current.csp,
      sanitize: optionsRef.current.sanitize,
      maxBytes: optionsRef.current.maxBytes,
      sandboxTokens: optionsRef.current.sandboxTokens,
      allowUnsafeSandboxTokens: optionsRef.current.allowUnsafeSandboxTokens,
      injectScrollbarStyle: optionsRef.current.injectScrollbarStyle,
      externalProtocols: optionsRef.current.externalProtocols,
    });
    if (source === undefined) return;
    chainRef.current = chainRef.current
      .then(() => handleRef.current?.render(source))
      // Rejections are already surfaced through the onError wrapper above.
      .catch(() => {});
  }, [source, policyKey]);

  return <div ref={containerRef} className={className} style={style} />;
});
