const AUTHOR_SCROLLBAR_RE = /::-webkit-scrollbar|scrollbar-width|scrollbar-color/i;

const FILL_HEIGHT = `html, body {
  min-height: 100%;
}
`;

function scrollbarStyle(content: boolean): string {
  return `<style data-html-preview-sandbox-scrollbar>
:root {
  color-scheme: light;
}
${content ? '' : FILL_HEIGHT}* {
  scrollbar-width: thin;
  scrollbar-color: rgba(96, 112, 128, 0.45) transparent;
}
*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
*::-webkit-scrollbar-thumb {
  background: rgba(96, 112, 128, 0.38);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}
</style>`;
}

export function hasAuthorScrollbarStyle(html: string): boolean {
  return AUTHOR_SCROLLBAR_RE.test(html || '');
}

export function injectScrollbarStyle(html: string): string {
  return injectPreviewScrollbarStyle(html, false);
}

export function injectPreviewScrollbarStyle(html: string, content: boolean): string {
  if (hasAuthorScrollbarStyle(html)) return html;
  const style = scrollbarStyle(content);

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${style}</head>`);
  }

  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (match: string) => `${match}${style}`);
  }

  return `${html}${style}`;
}
