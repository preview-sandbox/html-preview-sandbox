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
  strippedAll: boolean;
}

export interface CspViolationReport {
  effectiveDirective: string;
  blockedURI: string;
  sourceFile?: string;
  lineNumber?: number;
  sample?: string;
}

export type PreviewErrorCode = 'OVERSIZED' | 'DECODE_FAILED' | 'EMPTY_AFTER_SANITIZE' | 'RENDER_FAILED';

export interface PreviewErrorShape extends Error {
  code: PreviewErrorCode;
  cause?: unknown;
}

export interface PreviewOptions {
  csp?: CspPreset | CspPolicy;
  sanitize?: SanitizeOptions;
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
  sanitizeReport: SanitizeReport;
}

export interface PreviewHandle {
  render(input: PreviewInput): Promise<RenderResult>;
  updateOptions(patch: Partial<PreviewOptions>): void;
  notifyNavigationAttempt(url: string, context?: { source: OpenExternalSource }): void;
  destroy(): void;
  readonly iframe: HTMLIFrameElement | null;
}
