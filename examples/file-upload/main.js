import { createPreview } from '../../dist/index.browser.js';

const $ = (id) => document.getElementById(id);

// Host callbacks: surface the sanitize report and errors so the UI can show what
// happened. onOpenExternal mediates links the previewed file might contain.
const preview = createPreview($('preview'), {
  csp: 'strict',
  onOpenExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
  onError(err) {
    // Fires for OVERSIZED / DECODE_FAILED / EMPTY_AFTER_SANITIZE / RENDER_FAILED.
    showError(err.code, err.message);
  },
});
window.preview = preview; // exposed for the Playwright smoke test

function showError(code, message) {
  const el = $('error');
  el.textContent = `${code}: ${message}`;
  el.classList.add('show');
}

function clearError() {
  $('error').classList.remove('show');
}

function renderResult(result) {
  $('encoding').textContent = result.encoding;
  const removals = [
    ...result.sanitizeReport.removedTags.map((t) => `tag <${t.tag}> ×${t.count}`),
    ...result.sanitizeReport.removedAttributes.map((a) => `attr ${a.tag}[${a.attr}] ×${a.count}`),
    ...result.sanitizeReport.removedSchemes.map((s) => `scheme ${s.scheme} ×${s.count}`),
  ];
  $('removed').textContent = removals.length ? String(removals.length) : '0 (clean)';
  $('removed-list').innerHTML = '';
  for (const line of removals) {
    const li = document.createElement('li');
    li.textContent = line;
    $('removed-list').appendChild(li);
  }
}

async function handleFile(file) {
  if (!file) return;
  clearError();
  $('name').textContent = `${file.name} (${file.size} bytes)`;
  $('encoding').textContent = '…';
  $('removed').textContent = '…';
  $('removed-list').innerHTML = '';

  preview.updateOptions({ maxBytes: Number($('maxbytes').value) || undefined });

  try {
    // The library accepts the File directly — it decodes the bytes (BOM / declared
    // charset / UTF-8 fallback) before sanitizing and rendering.
    const result = await preview.render(file);
    renderResult(result);
  } catch {
    // The error state is already shown via onError; nothing else to do here.
  }
}

// File input
$('file').addEventListener('change', (e) => handleFile(e.target.files[0]));

// Drag & drop
const drop = $('drop');
for (const type of ['dragenter', 'dragover']) {
  drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.add('dragover'); });
}
for (const type of ['dragleave', 'drop']) {
  drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.remove('dragover'); });
}
drop.addEventListener('drop', (e) => handleFile(e.dataTransfer?.files?.[0]));
