import { createPreview } from '../../dist/index.browser.js';

const report = `<style>
  body { color: #14213d; font: 15px system-ui, sans-serif; margin: 18px; }
  h2 { margin: 0 0 6px; }
  summary { cursor: pointer; color: #106b54; }
  ul { padding: 0; list-style: none; }
  li { display: grid; grid-template-columns: 84px 1fr 2ch; align-items: center; gap: 8px; margin: 12px 0; }
  .track { display: block; height: 8px; background: #e5eee9; border-radius: 4px; overflow: hidden; }
  .bar { display: block; height: 100%; background: #1f8a70; }
</style>
<h2>Weekly delivery report</h2>
<p>92 of 100 orders shipped.</p>
<details>
  <summary>Daily breakdown</summary>
  <ul>
    <li>Monday <span class="track" aria-hidden="true"><span class="bar" style="width: 90%"></span></span>18</li>
    <li>Tuesday <span class="track" aria-hidden="true"><span class="bar" style="width: 80%"></span></span>16</li>
    <li>Wednesday <span class="track" aria-hidden="true"><span class="bar" style="width: 100%"></span></span>20</li>
    <li>Thursday <span class="track" aria-hidden="true"><span class="bar" style="width: 95%"></span></span>19</li>
    <li>Friday <span class="track" aria-hidden="true"><span class="bar" style="width: 95%"></span></span>19</li>
  </ul>
</details>`;

const host = document.querySelector('#preview');
const mode = document.querySelector('#mode');
const min = document.querySelector('#min');
const max = document.querySelector('#max');
const height = document.querySelector('#frame-height');
const error = document.querySelector('#bounds-error');

const preview = createPreview(host, {
  onFrameResize({ height: applied }) {
    height.textContent = `${Math.round(applied)} px`;
  },
});

async function render() {
  const content = mode.value === 'content';
  for (const label of document.querySelectorAll('[data-bound]')) label.hidden = !content;
  const minHeight = min.valueAsNumber;
  const maxHeight = max.valueAsNumber;
  try {
    preview.updateOptions({ sizing: content ? { mode: 'content', minHeight, maxHeight } : { mode: 'fill' } });
    error.hidden = true;
    host.dataset.mode = mode.value;
    await preview.render(report);
  } catch {
    error.hidden = false;
  }
}

document.querySelector('#sizing-controls').addEventListener('change', render);
document.querySelector('#sizing-controls').addEventListener('submit', (event) => event.preventDefault());
render();
