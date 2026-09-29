export type PreviewInput = string | ArrayBuffer | Uint8Array | Blob | File;
export type CspPreset = 'strict' | 'balanced' | 'offline';
export type OpenExternalSource = 'link' | 'window.open' | 'navigation';

export interface CspPolicy {
  preset?: CspPreset;
  scriptHosts?: string[];
  styleHosts?: string[];
  imgHosts?: string[];
  fontHosts?: string[];
  connectHosts?: string[];
  directives?: Record<string, string>;
}

export interface SanitizeOptions {
  allowScripts?: boolean;
  allowInlineEvents?: boolean;
  extraTags?: string[];
  extraAttributes?: Record<string, string[]>;
  extraSchemes?: string[];
  dropTags?: string[];
}

export interface SanitizeReport {
  removedTags: Array<{ tag: string; count: number }>;
  removedAttributes: Array<{ tag: string; attr: string; count: number }>;
  removedSchemes: Array<{ scheme: string; count: number }>;
  /** True when no body text/elements or head runtime resources remain. Empty input also reports true. */
  strippedAll: boolean;
}

export interface CspViolationReport {
  effectiveDirective: string;
  blockedURI: string;
  sourceFile?: string;
  lineNumber?: number;
  sample?: string;
}

export type PreviewErrorCode =
  | 'OVERSIZED'
  | 'DECODE_FAILED'
  /** @deprecated Reserved for compatibility; current renders report empty output through SanitizeReport.strippedAll. */
  | 'EMPTY_AFTER_SANITIZE'
  | 'RENDER_FAILED';

export interface PreviewErrorShape extends Error {
  code: PreviewErrorCode;
  cause?: unknown;
  /** Present for OVERSIZED errors. */
  actualBytes?: number;
  /** Present for OVERSIZED errors. */
  maxBytes?: number;
}

export interface PreviewOptions {
  csp?: CspPreset | CspPolicy;
  sanitize?: SanitizeOptions;
  /** Byte limit for normalizeInput and the preview/document pipeline. Not used by direct sanitizeHtml calls. */
  maxBytes?: number;
  sandboxTokens?: string[];
  allowUnsafeSandboxTokens?: boolean;
  externalProtocols?: string[];
  allowExternalUrl?: (url: string, context: { source: OpenExternalSource }) => boolean;
  injectScrollbarStyle?: boolean;
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
  onOpenExternal?: (url: string, context: { source: OpenExternalSource }) => void;
  onCspViolation?: (report: CspViolationReport) => void;
  onSanitize?: (report: SanitizeReport) => void;
  onNavigationAttempt?: (url: string, context: { source: OpenExternalSource }) => void;
  onError?: (error: PreviewErrorShape) => void;
}

export interface RenderResult {
  html: string;
  encoding: string;
  /** Original input size in bytes before sanitization and document injection. */
  size: number;
  sanitizeReport: SanitizeReport;
}

export interface PreviewHandle {
  /** Concurrent calls resolve independently, but only the latest call may update the iframe. */
  render(input: PreviewInput): Promise<RenderResult>;
  updateOptions(patch: Partial<PreviewOptions>): void;
  notifyNavigationAttempt(url: string, context?: { source: OpenExternalSource }): void;
  destroy(): void;
  readonly iframe: HTMLIFrameElement | null;
}
