import type { PreviewFrameSize, PreviewOptions, PreviewSizingOptions } from '../../src/index.js';
import type { PreviewSizingOptions as BrowserSizingOptions } from '../../src/index.browser.js';
import type { PreviewFrameSize as ReactFrameSize, SafeHtmlPreviewProps } from '../../src/react.js';

export const fill: PreviewSizingOptions = {};
export const content: BrowserSizingOptions = { mode: 'content', minHeight: 0, maxHeight: 900 };
export const observe: PreviewOptions['onFrameResize'] = ({ width, height }: PreviewFrameSize) => {
  const size: ReactFrameSize = { width, height };
  void size;
};
export const react: SafeHtmlPreviewProps = { source: '<p>Hello</p>', sizing: content, onFrameResize: observe };
// @ts-expect-error Bounds can only be supplied with explicit content mode.
export const invalidFill: PreviewSizingOptions = { mode: 'fill', minHeight: 10 };
// @ts-expect-error A bound alone does not enable content mode.
export const invalidImplicit: PreviewSizingOptions = { maxHeight: 300 };
