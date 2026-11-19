import { expect, test } from '@playwright/test';

async function renderLayout(page, html, sizing = {}) {
  await page.goto('/examples/content-sizing/');
  await page.evaluate(
    async ({ html, sizing }) => {
      const { createPreview } = await import('/dist/index.browser.js');
      const host = document.createElement('div');
      host.id = 'layout-probe';
      document.body.prepend(host);
      window.layoutPreview = createPreview(host, {
        sizing: { mode: 'content', minHeight: 0, maxHeight: 500, ...sizing },
      });
      await window.layoutPreview.render(html);
    },
    { html, sizing },
  );
  return page.locator('#layout-probe iframe');
}

async function heightOverFrames(frame) {
  return frame.evaluate(async (node) => {
    const heights = [];
    for (let index = 0; index < 8; index += 1) {
      await new Promise(requestAnimationFrame);
      heights.push(node.getBoundingClientRect().height);
    }
    return [...new Set(heights)];
  });
}

test('content sizing accounts for collapsed margins and does not oscillate', async ({ page }) => {
  const frame = await renderLayout(
    page,
    '<style>body{margin:0}p{height:60px;margin:110px 0 70px}</style><p>Report</p>',
  );
  await expect(frame).toHaveCSS('height', '240px');
  expect(await heightOverFrames(frame)).toEqual([240]);
});

test('content sizing recovers from zero and includes out-of-flow content', async ({ page }) => {
  const frame = await renderLayout(page, '');
  await expect(frame).toHaveCSS('height', '0px');
  const body = page.frameLocator('#layout-probe iframe').locator('body');
  await body.evaluate((node) => {
    node.style.margin = '0';
    const report = node.ownerDocument.createElement('div');
    report.style.cssText = 'position:absolute;top:140px;height:35px';
    report.textContent = 'Out-of-flow note';
    node.append(report);
  });
  await expect(frame).toHaveCSS('height', '175px');
  expect(await heightOverFrames(frame)).toEqual([175]);
  await body.evaluate((node) => node.replaceChildren());
  await expect(frame).toHaveCSS('height', '0px');
});

test('content sizing observes a CSS-only change to the body border box', async ({ page }) => {
  const frame = await renderLayout(page, '<div style="height:80px">Report</div>', { minHeight: 20 });
  await expect(frame).toHaveCSS('height', '96px');
  await page
    .frameLocator('#layout-probe iframe')
    .locator('body')
    .evaluate((node) => {
      node.animate([{ paddingBottom: '0px' }, { paddingBottom: '85px' }], { duration: 200, fill: 'forwards' });
    });
  await expect(frame).toHaveCSS('height', '181px');
});

test('content sizing follows a late image with intrinsic dimensions', async ({ page }) => {
  const frame = await renderLayout(page, '<style>body{margin:0}img{display:block}</style><img alt="">');
  await expect(frame).toHaveCSS('height', '0px');
  await page
    .frameLocator('#layout-probe iframe')
    .locator('img')
    .evaluate((node) => {
      const drawing =
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="135"><rect width="40" height="135"/></svg>';
      node.src = `data:image/svg+xml,${encodeURIComponent(drawing)}`;
    });
  await expect(frame).toHaveCSS('height', '135px');
});

test('replacing and destroying a frame cancel pending host resize work', async ({ page }) => {
  const frame = await renderLayout(page, '<div style="height:80px">Report</div>', { minHeight: 20 });
  await expect(frame).toHaveCSS('height', '96px');
  await page.evaluate(() => {
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    let id = 0;
    const pending = new Map();
    window.resizeTest = {
      pending,
      stopped: 0,
      restore() {
        window.requestAnimationFrame = request;
        window.cancelAnimationFrame = cancel;
      },
    };
    window.requestAnimationFrame = (callback) => {
      pending.set(--id, callback);
      return id;
    };
    window.cancelAnimationFrame = (key) => {
      if (pending.delete(key)) window.resizeTest.stopped++;
      else if (key >= 0) cancel(key);
    };
  });
  await page
    .frameLocator('#layout-probe iframe')
    .locator('body > div')
    .evaluate((node) => {
      node.style.height = '200px';
    });
  await expect.poll(() => page.evaluate(() => window.resizeTest.pending.size)).toBe(1);

  const first = await page.evaluate(async () => {
    const oldFrame = window.layoutPreview.iframe;
    await window.layoutPreview.render('<div style="height:135px">Replacement</div>');
    return { height: oldFrame.style.height, stopped: window.resizeTest.stopped };
  });
  expect(first).toEqual({ height: '96px', stopped: 1 });
  await expect.poll(() => page.evaluate(() => window.resizeTest.pending.size)).toBe(1);
  const final = await page.evaluate(() => {
    window.layoutPreview.destroy();
    window.resizeTest.restore();
    return { pending: window.resizeTest.pending.size, stopped: window.resizeTest.stopped };
  });
  expect(final).toEqual({ pending: 0, stopped: 2 });
  await expect(frame).toHaveCount(0);
});

test('content sizing settles viewport-dependent feedback and resumes after a document change', async ({ page }) => {
  const frame = await renderLayout(
    page,
    '<style>body{margin:0}div{height:290px}@media(min-height:200px){div{height:90px}}</style><div>Report</div>',
    { minHeight: 60 },
  );
  await expect.poll(() => heightOverFrames(frame)).toEqual([290]);
  await page
    .frameLocator('#layout-probe iframe')
    .locator('body > div')
    .evaluate((node) => {
      node.style.height = '130px';
    });
  await expect(frame).toHaveCSS('height', '130px');
});

test('a navigation remount keeps sizing but applies the current sandbox settings', async ({ page }) => {
  const frame = await renderLayout(page, '<div style="height:80px">Report</div>', { minHeight: 20 });
  await expect(frame).toHaveCSS('height', '96px');
  await page.evaluate(() => {
    window.layoutPreview.updateOptions({ sizing: { mode: 'fill' }, sandboxTokens: [] });
    window.layoutPreview.notifyNavigationAttempt('https://example.com/');
  });
  await expect(frame).toHaveAttribute('sandbox', '');
  await expect(frame).toHaveCSS('height', '96px');
});

test('content sizing example grows with its report details and returns to the original height', async ({ page }) => {
  await page.goto('/examples/content-sizing/');
  const size = page.locator('#frame-height');
  const frame = page.locator('#preview iframe');
  await expect(frame).toHaveCSS('min-height', '80px');
  await expect.poll(async () => Number.parseInt((await size.textContent()) ?? '', 10) || 0).toBeGreaterThan(80);
  const initial = Number.parseInt(await size.textContent(), 10);
  const details = page.frameLocator('#preview iframe').getByText('Daily breakdown');
  await details.click();
  await expect.poll(async () => Number.parseInt(await size.textContent(), 10)).toBeGreaterThan(initial);
  await details.click();
  await expect(size).toHaveText(`${initial} px`);
});

test('content mode grows, shrinks to zero, and applies the maximum', async ({ page }) => {
  await page.goto('/examples/web/');
  await page.evaluate(async () => {
    const { createPreview } = await import('/dist/index.browser.js');
    const host = document.createElement('div');
    host.id = 'sizing-host';
    document.body.append(host);
    window.sizingPreview = createPreview(host, {
      sizing: { mode: 'content', minHeight: 0, maxHeight: 300 },
      sanitize: { allowScripts: false },
    });
    await window.sizingPreview.render('<div style="height: 80px"></div>');
  });
  const frame = page.locator('#sizing-host iframe');
  const body = page.frameLocator('#sizing-host iframe').locator('body');
  await expect(frame).toHaveCSS('height', '96px');
  await body.evaluate((node) => {
    node.firstElementChild.style.height = '500px';
  });
  await expect(frame).toHaveCSS('height', '300px');
  expect(await body.evaluate((node) => node.ownerDocument.scrollingElement.scrollHeight)).toBeGreaterThan(300);
  await body.evaluate((node) => {
    node.firstElementChild.style.height = '120px';
  });
  await expect(frame).toHaveCSS('height', '136px');
  await body.evaluate((node) => node.replaceChildren());
  await expect(frame).toHaveCSS('height', '0px');
});

test('callback-only updates observe the mounted frame without replacing it', async ({ page }) => {
  await page.goto('/examples/web/');
  await page.evaluate(() => {
    window.initialFrame = window.preview.iframe;
    window.sizeEvents = [];
    window.preview.updateOptions({ onFrameResize: (size) => window.sizeEvents.push({ first: size }) });
  });
  await expect.poll(() => page.evaluate(() => window.sizeEvents[0]?.first?.height)).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.preview.updateOptions({ onFrameResize: (size) => window.sizeEvents.push({ second: size }) });
    window.initialFrame.style.height = '219px';
  });
  await expect.poll(() => page.evaluate(() => window.sizeEvents.at(-1)?.second?.height)).toBe(219);
  const stable = await page.evaluate(async () => {
    window.preview.updateOptions({ onFrameResize: undefined });
    window.sizeEvents.length = 0;
    window.initialFrame.style.height = '151px';
    for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
    return window.preview.iframe === window.initialFrame && window.sizeEvents.length === 0;
  });
  expect(stable).toBe(true);
});

test('content sizing stays isolated and changes only when the next document is rendered', async ({ page }) => {
  await page.goto('/examples/web/');
  const constraints = await page.evaluate(async () => {
    const { createPreview } = await import('/dist/index.browser.js');
    const handles = [];
    for (const id of ['first', 'second']) {
      const host = document.createElement('div');
      host.id = id;
      document.body.append(host);
      const preview = createPreview(host, { sizing: { mode: 'content', minHeight: 30, maxHeight: 250 } });
      handles.push(preview);
      await preview.render('<div style="height: 80px"></div>');
    }
    window.sizingHandles = handles;
    let invalid = false;
    try {
      handles[0].updateOptions({ sandboxTokens: [] });
    } catch (error) {
      invalid = error instanceof TypeError;
    }
    return invalid;
  });
  expect(constraints).toBe(true);
  await expect(page.locator('#first iframe')).toHaveCSS('height', '96px');
  await expect(page.locator('#second iframe')).toHaveCSS('height', '96px');
  await page
    .frameLocator('#first iframe')
    .locator('body > div')
    .evaluate((node) => {
      node.style.height = '165px';
    });
  await expect(page.locator('#first iframe')).toHaveCSS('height', '181px');
  await expect(page.locator('#second iframe')).toHaveCSS('height', '96px');
  const beforeNextRender = await page.evaluate(() => {
    const [first] = window.sizingHandles;
    first.updateOptions({ sizing: { mode: 'fill' } });
    return first.iframe.style.height;
  });
  expect(beforeNextRender).toBe('181px');
  const finalStyles = await page.evaluate(async () => {
    const [first] = window.sizingHandles;
    await first.render('<p>Fill preview</p>');
    return [first.iframe.style.height, first.iframe.style.maxHeight, first.iframe.getAttribute('sandbox')];
  });
  expect(finalStyles.slice(0, 2)).toEqual(['100%', '']);
  expect(finalStyles[2]).toContain('allow-scripts');
  expect(finalStyles[2]).not.toContain('allow-same-origin');
  await page.evaluate(() => {
    for (const preview of window.sizingHandles) preview.destroy();
  });
  await expect(page.locator('#first iframe, #second iframe')).toHaveCount(0);
});
