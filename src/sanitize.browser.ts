import createDOMPurify from 'dompurify';
import { createSanitizer } from './sanitize-core.js';

export const sanitizeHtml = createSanitizer(window, createDOMPurify);
