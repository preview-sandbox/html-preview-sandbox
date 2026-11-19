import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeHtmlPreview } from '../dist/react.js';

function installDom() {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  return {
    container: dom.window.document.querySelector('#root'),
    restore() {
      dom.window.close();
      globalThis.document = previous.document;
      globalThis.window = previous.window;
      globalThis.IS_REACT_ACT_ENVIRONMENT = previous.IS_REACT_ACT_ENVIRONMENT;
    },
  };
}

test('SafeHtmlPreview updates a changed forwarded ref without recreating the preview', async () => {
  const fixture = installDom();
  const root = createRoot(fixture.container);
  const firstRef = createRef();
  const secondRef = createRef();

  try {
    await act(async () => {
      root.render(React.createElement(SafeHtmlPreview, { ref: firstRef }));
    });
    const handle = firstRef.current;
    assert.ok(handle);

    await act(async () => {
      root.render(React.createElement(SafeHtmlPreview, { ref: secondRef }));
    });

    assert.equal(firstRef.current, null);
    assert.equal(secondRef.current, handle);
  } finally {
    await act(async () => root.unmount());
    fixture.restore();
  }
});

test('SafeHtmlPreview routes runtime warnings to the latest logger prop', async () => {
  const fixture = installDom();
  const root = createRoot(fixture.container);
  const handleRef = createRef();
  const firstWarnings = [];
  const latestWarnings = [];
  const firstLogger = { info() {}, warn: (message) => firstWarnings.push(message), error() {} };
  const latestLogger = { info() {}, warn: (message) => latestWarnings.push(message), error() {} };

  try {
    await act(async () => {
      root.render(React.createElement(SafeHtmlPreview, { ref: handleRef, logger: firstLogger }));
    });
    await act(async () => {
      root.render(React.createElement(SafeHtmlPreview, { ref: handleRef, logger: latestLogger }));
    });

    handleRef.current.notifyNavigationAttempt('javascript:alert(1)');

    assert.equal(firstWarnings.length, 0);
    assert.equal(latestWarnings.length, 1);
  } finally {
    await act(async () => root.unmount());
    fixture.restore();
  }
});

test('SafeHtmlPreview reports invalid sizing without losing its existing preview', async () => {
  const fixture = installDom();
  const root = createRoot(fixture.container);
  const ref = createRef();
  const errors = [];
  const onError = (error) => errors.push(error);
  const render = (options) =>
    act(async () => root.render(React.createElement(SafeHtmlPreview, { ref, onError, ...options })));

  try {
    await render({ source: '<p>First report</p>', sizing: { mode: 'content', minHeight: 200, maxHeight: 100 } });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].code, 'RENDER_FAILED');
    assert.equal(ref.current.iframe, null);

    await render({ source: '<p>Valid report</p>', sizing: { mode: 'content' } });
    const frame = ref.current.iframe;
    assert.match(frame.srcdoc, /Valid report/);

    await render({ source: '<p>Do not replace</p>', sizing: { mode: 'content' }, sandboxTokens: [] });
    assert.equal(errors.length, 2);
    assert.equal(errors[1].code, 'RENDER_FAILED');
    assert.equal(ref.current.iframe, frame);
  } finally {
    await act(async () => root.unmount());
    fixture.restore();
  }
});
