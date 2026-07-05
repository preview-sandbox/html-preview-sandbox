const AUTHOR_SCROLLBAR_RE = /::-webkit-scrollbar|scrollbar-width|scrollbar-color/i;

const SCROLLBAR_STYLE = `<style data-html-preview-sandbox-scrollbar>
:root {
  color-scheme: light;
}
html, body {
  min-height: 100%;
}
* {
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

export function hasAuthorScrollbarStyle(html: string): boolean {
  return AUTHOR_SCROLLBAR_RE.test(html || '');
}

export function injectScrollbarStyle(html: string): string {
  if (hasAuthorScrollbarStyle(html)) return html;

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${SCROLLBAR_STYLE}</head>`);
  }

  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (match: string) => `${match}${SCROLLBAR_STYLE}`);
  }

  return `${html}${SCROLLBAR_STYLE}`;
}
