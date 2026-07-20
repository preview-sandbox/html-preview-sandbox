import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeHtmlPreview } from '../../src/react.tsx';

const REPORT = `<div style="font-family:system-ui;padding:22px;color:#17202a">
  <h1>Hello from React</h1>
  <p>This document runs inside the sandboxed iframe. The inline script below executes,
  but the <code>onerror</code> attribute on the image is stripped by the sanitizer.</p>
  <p><a href="https://example.com/">External link</a> — routed to the host callback, not opened here.</p>
  <img src="x" onerror="alert('nope')" alt="[sanitizer removed the onerror handler]">
  <script>console.log('script runs inside the sandbox')</script>
</div>`;

const SECOND = `<div style="font-family:system-ui;padding:22px;color:#17202a">
  <h1>Second document</h1>
  <p>Rendered after a <code>source</code> prop update — the previous document is fully replaced.</p>
</div>`;

// Larger than MAX_BYTES below, so rendering it exercises the OVERSIZED error path.
const OVERSIZED_BLOB = () => new Blob([`<h1>too big</h1>${'x'.repeat(200_000)}`]);
const MAX_BYTES = 64 * 1024;

window.__events = [];
let entryId = 0;

function App() {
  const [source, setSource] = useState(REPORT);
  const [csp, setCsp] = useState('strict');
  const [mounted, setMounted] = useState(true);
  const [entries, setEntries] = useState([]);
  const handleRef = useRef(null);

  const log = (kind, text) => setEntries((list) => [{ id: entryId++, kind, text }, ...list]);

  return (
    <div className="app">
      <header>
        <span className="brand-mark">HPS</span>
        <div className="brand-text">
          <h1>React example</h1>
          <p>
            <code>&lt;SafeHtmlPreview&gt;</code> from <code>html-preview-sandbox/react</code>
          </p>
        </div>
        <div className="controls">
          <button id="btn-swap" type="button" onClick={() => setSource(SECOND)}>
            Swap source
          </button>
          <button id="btn-ref-render" type="button" onClick={() => handleRef.current?.render('<h1>Rendered via ref</h1>')}>
            Render via ref
          </button>
          <button id="btn-oversize" type="button" onClick={() => setSource(OVERSIZED_BLOB())}>
            Oversized blob
          </button>
          <select id="csp-select" value={csp} onChange={(event) => setCsp(event.target.value)}>
            <option value="strict">csp: strict</option>
            <option value="balanced">csp: balanced</option>
            <option value="offline">csp: offline</option>
          </select>
          <button id="btn-unmount" type="button" onClick={() => setMounted((value) => !value)}>
            {mounted ? 'Unmount' : 'Mount'}
          </button>
        </div>
      </header>

      <main>
        <section className="pane">
          <div className="pane-head">Sandboxed preview</div>
          <div id="preview-root" className="pane-body">
            {mounted ? (
              <SafeHtmlPreview
                ref={handleRef}
                source={source}
                csp={csp}
                maxBytes={MAX_BYTES}
                style={{ height: '100%' }}
                onOpenExternal={(url) => {
                  window.__events.push(url);
                  log('external', `external → ${url}`);
                }}
                onSanitize={(report) => {
                  const removed = report.removedTags.length + report.removedAttributes.length;
                  log('sanitize', `sanitize: removed ${removed} item(s)`);
                }}
                onError={(error) => log('error', `${error.code}: ${error.message}`)}
              />
            ) : (
              <p className="placeholder">Component unmounted — the iframe and its listeners are gone.</p>
            )}
          </div>
        </section>
        <aside className="pane">
          <div className="pane-head">Host event log</div>
          <div id="log" className="pane-body log">
            {entries.length === 0 && <span className="placeholder">Interact with the preview…</span>}
            {entries.map((entry) => (
              <div key={entry.id} className={`entry ${entry.kind}`}>
                {entry.text}
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

createRoot(document.querySelector('#root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
