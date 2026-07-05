import type { SanitizeOptions, SanitizeReport } from './types.js';

const DEFAULT_ALLOWED_TAGS = [
  'html', 'head', 'body', 'title', 'meta', 'link', 'style', 'script',
  'main', 'section', 'article', 'aside', 'header', 'footer', 'nav',
  'div', 'span', 'p', 'br', 'hr', 'pre', 'code', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'a', 'strong', 'b', 'em', 'i', 'u', 's', 'small', 'mark', 'sub', 'sup',
  'img', 'picture', 'source', 'audio', 'video', 'canvas',
  'form', 'label', 'input', 'button', 'select', 'option', 'optgroup', 'textarea',
  'fieldset', 'legend', 'details', 'summary',
  'svg', 'g', 'defs', 'symbol', 'use', 'desc',
  'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path',
  'text', 'tspan', 'textPath', 'linearGradient', 'radialGradient', 'stop',
  'pattern', 'mask', 'clipPath', 'filter', 'feGaussianBlur', 'feColorMatrix',
  'feOffset', 'feMerge', 'feMergeNode', 'feBlend', 'feFlood', 'feComposite',
  'feTurbulence', 'feDisplacementMap', 'feDropShadow', 'marker',
  'animate', 'animateTransform', 'animateMotion', 'set', 'foreignObject',
];

const DISALLOWED_TAGS = ['base', 'object', 'embed', 'applet'];

const GLOBAL_ATTRS = [
  'class', 'id', 'style', 'title', 'lang', 'dir', 'role', 'tabindex', 'hidden',
  'aria-*', 'data-*',
];

const SAFE_INLINE_EVENTS = [
  'onclick', 'onauxclick', 'ondblclick',
  'oninput', 'onchange', 'onsubmit', 'onreset',
  'onkeydown', 'onkeyup', 'onkeypress',
  'onfocusin', 'onfocusout',
];

const SVG_ATTRS = [
  'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2',
  'width', 'height', 'd', 'points', 'transform', 'fill', 'fill-opacity',
  'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'stroke-miterlimit',
  'opacity', 'color', 'visibility', 'display', 'vector-effect',
  'viewBox', 'preserveAspectRatio', 'xmlns', 'xmlns:xlink',
  'href', 'xlink:href', 'offset', 'gradientUnits', 'gradientTransform',
  'spreadMethod', 'stop-color', 'stop-opacity', 'text-anchor',
  'dominant-baseline', 'alignment-baseline', 'font-family', 'font-size',
  'font-weight', 'font-style', 'letter-spacing', 'word-spacing',
  'text-decoration', 'dx', 'dy', 'rotate', 'startOffset', 'textLength',
  'lengthAdjust', 'clip-path', 'clip-rule', 'mask', 'filter', 'stdDeviation',
  'in', 'in2', 'result', 'mode', 'flood-color', 'flood-opacity', 'edgeMode',
  'patternUnits', 'patternTransform', 'patternContentUnits', 'markerWidth',
  'markerHeight', 'refX', 'refY', 'orient', 'markerUnits', 'marker-start',
  'marker-mid', 'marker-end', 'attributeName', 'attributeType', 'from', 'to',
  'by', 'values', 'dur', 'repeatCount', 'repeatDur', 'begin', 'end',
  'calcMode', 'keyTimes', 'keySplines', 'additive', 'accumulate',
  'fill-mode', 'restart',
];

const ATTRS_BY_TAG: Record<string, string[]> = {
  a: ['href', 'name', 'target', 'rel', 'download'],
  link: ['rel', 'href', 'as', 'crossorigin', 'integrity', 'referrerpolicy', 'type', 'media', 'sizes'],
  meta: ['charset', 'name', 'content', 'http-equiv', 'property'],
  img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes'],
  source: ['src', 'srcset', 'type', 'media'],
  input: ['type', 'name', 'value', 'placeholder', 'min', 'max', 'step', 'required', 'checked', 'disabled', 'readonly', 'pattern', 'maxlength'],
  button: ['type', 'name', 'value', 'disabled'],
  select: ['name', 'value', 'multiple', 'disabled', 'required'],
  option: ['value', 'selected', 'disabled'],
  textarea: ['name', 'value', 'placeholder', 'rows', 'cols', 'maxlength', 'required', 'disabled', 'readonly'],
  form: ['method', 'enctype', 'novalidate'],
  label: ['for'],
  audio: ['src', 'controls', 'autoplay', 'loop', 'muted', 'preload'],
  video: ['src', 'controls', 'autoplay', 'loop', 'muted', 'preload', 'poster', 'width', 'height'],
  script: ['src', 'type', 'async', 'defer', 'crossorigin', 'integrity', 'referrerpolicy', 'nomodule', 'nonce'],
};

const URL_ATTRS = new Set(['href', 'src', 'srcset', 'cite', 'xlink:href', 'action']);
const DEFAULT_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const MEDIA_TAGS = new Set(['img', 'audio', 'video', 'source', 'picture']);

function emptyReport(): SanitizeReport {
  return {
    removedTags: [],
    removedAttributes: [],
    removedSchemes: [],
    strippedAll: false,
  };
}

type CountedRecord = { count: number; [key: string]: unknown };

function increment<T extends CountedRecord>(list: T[], predicate: (item: T) => boolean, create: () => Omit<T, 'count'>): void {
  const existing = list.find(predicate);
  if (existing) {
    existing.count += 1;
    return;
  }
  list.push({ ...create(), count: 1 } as T);
}

function reportTag(report: SanitizeReport, tag: string): void {
  increment(report.removedTags, (item) => item.tag === tag, () => ({ tag }));
}

function reportAttr(report: SanitizeReport, tag: string, attr: string): void {
  increment(report.removedAttributes, (item) => item.tag === tag && item.attr === attr, () => ({ tag, attr }));
}

function reportScheme(report: SanitizeReport, scheme: string): void {
  increment(report.removedSchemes, (item) => item.scheme === scheme, () => ({ scheme }));
}

function normalizeName(name: unknown): string {
  return String(name || '').toLowerCase();
}

function matchesPattern(attr: string, pattern: string): boolean {
  const normalizedPattern = normalizeName(pattern);
  return normalizedPattern.endsWith('*')
    ? attr.startsWith(normalizedPattern.slice(0, -1))
    : attr === normalizedPattern;
}

function getAllowedTags(options: SanitizeOptions = {}): Set<string> {
  const tags = new Set(DEFAULT_ALLOWED_TAGS.map(normalizeName));
  if (options.allowScripts === false) tags.delete('script');
  for (const tag of options.extraTags ?? []) tags.add(normalizeName(tag));
  for (const tag of options.dropTags ?? []) tags.delete(normalizeName(tag));
  return tags;
}

function getAllowedAttrs(options: SanitizeOptions = {}): string[] {
  return [
    ...GLOBAL_ATTRS,
    ...(options.allowInlineEvents === false ? [] : SAFE_INLINE_EVENTS),
    ...SVG_ATTRS,
    ...Object.values(ATTRS_BY_TAG).flat(),
    ...(options.extraAttributes?.['*'] ?? []),
    ...Object.values(options.extraAttributes ?? {}).flat(),
  ];
}

function isAllowedAttr(tag: string, attr: string, options: SanitizeOptions = {}): boolean {
  if (GLOBAL_ATTRS.some((pattern) => matchesPattern(attr, pattern))) return true;
  if (options.allowInlineEvents !== false && SAFE_INLINE_EVENTS.map(normalizeName).includes(attr)) return true;
  if (SVG_ATTRS.map(normalizeName).includes(attr)) return true;
  if ((ATTRS_BY_TAG[tag] ?? []).map(normalizeName).includes(attr)) return true;
  if ((options.extraAttributes?.['*'] ?? []).map(normalizeName).includes(attr)) return true;
  if ((options.extraAttributes?.[tag] ?? []).map(normalizeName).includes(attr)) return true;
  return false;
}

function getScheme(raw: unknown): string {
  const trimmed = String(raw || '').trim();
  const match = trimmed.match(/^([a-zA-Z][\w+.-]*):/);
  return match ? `${match[1].toLowerCase()}:` : '';
}

function isAllowedUrl(raw: unknown, tag: string, options: SanitizeOptions = {}): boolean {
  const scheme = getScheme(raw);
  if (!scheme) return true;
  if (DEFAULT_SCHEMES.has(scheme)) return true;
  if (MEDIA_TAGS.has(tag) && (scheme === 'data:' || scheme === 'blob:')) return true;
  return (options.extraSchemes ?? [])
    .map((item) => (item.endsWith(':') ? item.toLowerCase() : `${item.toLowerCase()}:`))
    .includes(scheme);
}

function splitSrcsetCandidates(raw: unknown): string[] {
  return String(raw || '')
    .split(',')
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => candidate.split(/\s+/)[0])
    .filter(Boolean);
}

function disallowedSrcsetSchemes(raw: unknown, tag: string, options: SanitizeOptions = {}): string[] {
  const schemes = new Set<string>();
  for (const url of splitSrcsetCandidates(raw)) {
    if (!isAllowedUrl(url, tag, options)) {
      schemes.add(getScheme(url) || 'invalid');
    }
  }
  return [...schemes];
}

function isDangerousMeta(node: Element): boolean {
  if (normalizeName(node.nodeName) !== 'meta') return false;
  const equiv = normalizeName(node.getAttribute('http-equiv'));
  return equiv === 'refresh' || equiv === 'content-security-policy';
}

// SVG animation elements can rewrite URL attributes at runtime
// (<animate attributeName="href" values="javascript:...">), and the animation
// value attributes (values/from/to/by) do not go through URL scheme filtering.
// Any animation element that targets a URL attribute is removed entirely.
const ANIMATION_TAGS = new Set(['animate', 'set', 'animatemotion', 'animatetransform']);
const URL_TARGET_ATTRS = new Set(['href', 'xlink:href', 'src']);

function isUrlTargetingAnimation(node: Element): boolean {
  if (!ANIMATION_TAGS.has(normalizeName(node.nodeName))) return false;
  const target = normalizeName(node.getAttribute?.('attributeName'));
  return URL_TARGET_ATTRS.has(target);
}

function applyProjectHooks(purifier: any, report: SanitizeReport, options: SanitizeOptions): void {
  // Nodes flagged for removal during uponSanitizeElement (where their original
  // attributes are still readable) but detached later in afterSanitizeElements,
  // because detaching mid-walk breaks DOMPurify's tree traversal.
  const pendingRemoval = new WeakSet<Element>();

  purifier.addHook('uponSanitizeElement', (node, data) => {
    const tag = normalizeName(data.tagName || node.nodeName);
    if (DISALLOWED_TAGS.includes(tag)) reportTag(report, tag);
    if (isDangerousMeta(node)) reportAttr(report, 'meta', 'http-equiv');
    // Detect URL-targeting SVG animations here, before DOMPurify strips their
    // attributeName/values attributes (which would hide the vector from later hooks).
    if (isUrlTargetingAnimation(node)) {
      reportTag(report, tag);
      pendingRemoval.add(node);
    }
  });

  purifier.addHook('afterSanitizeElements', (node) => {
    if (isDangerousMeta(node) || pendingRemoval.has(node)) {
      node.remove();
    }
  });

  purifier.addHook('afterSanitizeAttributes', (node) => {
    const tag = normalizeName(node.nodeName);
    if (!node.attributes) return;

    for (const attrNode of [...node.attributes]) {
      const attr = normalizeName(attrNode.name);
      if (!isAllowedAttr(tag, attr, options)) {
        reportAttr(report, tag, attr);
        node.removeAttribute(attrNode.name);
        continue;
      }

      if (URL_ATTRS.has(attr) && !isAllowedUrl(attrNode.value, tag, options)) {
        reportAttr(report, tag, attr);
        reportScheme(report, getScheme(attrNode.value) || 'invalid');
        node.removeAttribute(attrNode.name);
        continue;
      }

      if (attr === 'srcset') {
        const blockedSchemes = disallowedSrcsetSchemes(attrNode.value, tag, options);
        if (blockedSchemes.length) {
          reportAttr(report, tag, attr);
          for (const scheme of blockedSchemes) reportScheme(report, scheme);
          node.removeAttribute(attrNode.name);
        }
      }
    }
  });
}

function collectDomPurifyRemoved(purifier: any, report: SanitizeReport): void {
  for (const item of purifier.removed ?? []) {
    if (item.element) {
      reportTag(report, normalizeName(item.element.nodeName));
    }
    if (item.attribute) {
      reportAttr(report, normalizeName(item.from?.nodeName || '*'), normalizeName(item.attribute.name));
      if (URL_ATTRS.has(normalizeName(item.attribute.name))) {
        reportScheme(report, getScheme(item.attribute.value) || 'invalid');
      }
    }
  }
}

export function createSanitizer(runtimeWindow: any, createDOMPurify: any) {
  return function sanitizeHtml(rawHtml: string, options: SanitizeOptions = {}): { html: string; report: SanitizeReport } {
    const purifier = createDOMPurify(runtimeWindow);
    const report = emptyReport();
    const allowedTags = [...getAllowedTags(options)];

    applyProjectHooks(purifier, report, options);

    const html = purifier.sanitize(rawHtml, {
      WHOLE_DOCUMENT: true,
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: getAllowedAttrs(options),
      ADD_TAGS: allowedTags,
      ADD_ATTR: getAllowedAttrs(options),
      FORBID_TAGS: DISALLOWED_TAGS,
      KEEP_CONTENT: true,
      ALLOW_DATA_ATTR: true,
      ALLOW_ARIA_ATTR: true,
    });

    collectDomPurifyRemoved(purifier, report);

    const parser = new runtimeWindow.DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    report.strippedAll = !doc.body.textContent?.trim() && !doc.body.querySelector('script,style,img,svg,canvas,video,audio');

    return { html, report };
  };
}
