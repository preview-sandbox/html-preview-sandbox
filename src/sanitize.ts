import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { createSanitizer } from './sanitize-core.js';

const nodeWindow = new JSDOM('').window;

export const sanitizeHtml = createSanitizer(nodeWindow, createDOMPurify);
