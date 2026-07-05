import { createHtmlDocument } from './document.browser.js';
import { createPreviewFactory } from './renderer-core.js';

export const createPreview = createPreviewFactory(createHtmlDocument);
