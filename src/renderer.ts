import { createHtmlDocument } from './document.js';
import { createPreviewFactory } from './renderer-core.js';

export const createPreview = createPreviewFactory(createHtmlDocument);
