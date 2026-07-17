import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeHtmlPreview } from '../../src/react.tsx';

const FIRST = '<h1>Hello from React</h1><p><a href="https://example.com/">External link</a></p>';
const SECOND = '<h1>Second document</h1>';

window.__events = [];

function App() {
  const [source, setSource] = useState(FIRST);
  const [mounted, setMounted] = useState(true);
  const handleRef = useRef(null);

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', gap: 8 }}>
      <div>
        <button id="btn-swap" type="button" onClick={() => setSource(SECOND)}>
          Swap source
        </button>
        <button id="btn-unmount" type="button" onClick={() => setMounted(false)}>
          Unmount
        </button>
        <button id="btn-ref-render" type="button" onClick={() => handleRef.current?.render('<h1>Rendered via ref</h1>')}>
          Render via ref
        </button>
      </div>
      <div id="preview-root" style={{ minHeight: 0 }}>
        {mounted && (
          <SafeHtmlPreview
            ref={handleRef}
            source={source}
            csp="strict"
            style={{ height: '100%' }}
            onOpenExternal={(url) => window.__events.push(url)}
          />
        )}
      </div>
    </div>
  );
}

createRoot(document.querySelector('#root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
