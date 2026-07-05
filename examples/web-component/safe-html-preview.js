import { createPreview } from '../../dist/index.browser.js';

// A minimal <safe-html-preview> custom element wrapping createPreview.
// Attributes:
//   preset        — CSP preset: "strict" (default) | "balanced" | "offline"
//   open-external — "1" to open external links via window.open; otherwise links are dropped
// Property:
//   .source       — set to an HTML string / File / Blob / bytes to render
// Events:
//   sanitize, cspviolation, openexternal — CustomEvents mirroring the host callbacks
export class SafeHtmlPreview extends HTMLElement {
  #preview = null;
  #source = '';

  connectedCallback() {
    this.style.display = this.style.display || 'block';
    this.#preview = createPreview(this, {
      csp: this.getAttribute('preset') || 'strict',
      onSanitize: (report) => this.dispatchEvent(new CustomEvent('sanitize', { detail: report })),
      onCspViolation: (report) => this.dispatchEvent(new CustomEvent('cspviolation', { detail: report })),
      onOpenExternal: (url, context) => {
        this.dispatchEvent(new CustomEvent('openexternal', { detail: { url, ...context } }));
        if (this.getAttribute('open-external') === '1') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      },
    });
    if (this.#source) this.render();
  }

  disconnectedCallback() {
    this.#preview?.destroy();
    this.#preview = null;
  }

  static get observedAttributes() {
    return ['preset'];
  }

  attributeChangedCallback(name) {
    if (name === 'preset' && this.#preview) {
      this.#preview.updateOptions({ csp: this.getAttribute('preset') || 'strict' });
      this.render();
    }
  }

  set source(value) {
    this.#source = value;
    this.render();
  }

  get source() {
    return this.#source;
  }

  async render() {
    if (!this.#preview || !this.#source) return;
    await this.#preview.render(this.#source);
  }
}

customElements.define('safe-html-preview', SafeHtmlPreview);
