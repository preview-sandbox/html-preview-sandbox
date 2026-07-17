# React example

`<SafeHtmlPreview>` from `html-preview-sandbox/react`, exercised as a tiny app:
swap the source, unmount cleanly, and drive the underlying `PreviewHandle`
through the forwarded ref.

Unlike the other examples, React needs a build step. From the repository root:

```bash
npm install
npm run build        # also bundles this app into examples/react/app.js
npm run serve        # http://127.0.0.1:4173/examples/react/
```

In your own project it's just:

```jsx
import { SafeHtmlPreview } from 'html-preview-sandbox/react';

<SafeHtmlPreview source={html} csp="strict" onOpenExternal={(url) => window.open(url, '_blank', 'noopener,noreferrer')} />
```
