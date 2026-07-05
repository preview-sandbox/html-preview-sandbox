import { ERROR_CODES, PreviewError } from './errors.js';
import type { PreviewInput } from './types.js';

export const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

const BOM_UTF8 = [0xef, 0xbb, 0xbf];
const BOM_UTF16_LE = [0xff, 0xfe];
const BOM_UTF16_BE = [0xfe, 0xff];

export interface DecodeResult {
  html: string;
  encoding: string;
  usedBom: boolean;
  size: number;
}

function startsWithBytes(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, index) => bytes[index] === byte);
}

function decodeWith(bytes: Uint8Array, encoding: string, fatal = false): string | null {
  try {
    return new TextDecoder(encoding, { fatal }).decode(bytes);
  } catch {
    return null;
  }
}

function findDeclaredCharset(head: string): string | null {
  const metaCharset = head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i);
  if (metaCharset?.[1]) return metaCharset[1].toLowerCase();

  const contentType = head.match(/charset\s*=\s*["']?([\w-]+)/i);
  if (contentType?.[1]) return contentType[1].toLowerCase();

  return null;
}

export async function normalizeInput(input: PreviewInput, options: { maxBytes?: number } = {}): Promise<DecodeResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  if (typeof input === 'string') {
    const size = new TextEncoder().encode(input).byteLength;
    if (size > maxBytes) {
      throw new PreviewError(ERROR_CODES.OVERSIZED, `HTML input exceeds ${maxBytes} bytes`);
    }
    return { html: input, encoding: 'utf-8', usedBom: false, size };
  }

  let bytes;
  if (input instanceof Uint8Array) {
    bytes = input;
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (typeof Blob !== 'undefined' && input instanceof Blob) {
    bytes = new Uint8Array(await input.arrayBuffer());
  } else {
    throw new PreviewError(ERROR_CODES.DECODE_FAILED, 'Unsupported preview input');
  }

  if (bytes.byteLength > maxBytes) {
    throw new PreviewError(ERROR_CODES.OVERSIZED, `HTML input exceeds ${maxBytes} bytes`);
  }

  return decodeHtmlBytes(bytes);
}

export function decodeHtmlBytes(input: ArrayBuffer | Uint8Array): DecodeResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (startsWithBytes(bytes, BOM_UTF8)) {
    return {
      html: decodeWith(bytes.subarray(BOM_UTF8.length), 'utf-8') ?? '',
      encoding: 'utf-8',
      usedBom: true,
      size: bytes.byteLength,
    };
  }

  if (startsWithBytes(bytes, BOM_UTF16_LE)) {
    return {
      html: decodeWith(bytes.subarray(BOM_UTF16_LE.length), 'utf-16le') ?? '',
      encoding: 'utf-16le',
      usedBom: true,
      size: bytes.byteLength,
    };
  }

  if (startsWithBytes(bytes, BOM_UTF16_BE)) {
    return {
      html: decodeWith(bytes.subarray(BOM_UTF16_BE.length), 'utf-16be') ?? '',
      encoding: 'utf-16be',
      usedBom: true,
      size: bytes.byteLength,
    };
  }

  const strictUtf8 = decodeWith(bytes, 'utf-8', true);
  if (strictUtf8 !== null) {
    return { html: strictUtf8, encoding: 'utf-8', usedBom: false, size: bytes.byteLength };
  }

  const head = decodeWith(bytes.subarray(0, 4096), 'iso-8859-1') ?? '';
  const declared = findDeclaredCharset(head);

  if (declared && declared !== 'utf-8' && declared !== 'utf8') {
    const decoded = decodeWith(bytes, declared);
    if (decoded !== null) {
      return { html: decoded, encoding: declared, usedBom: false, size: bytes.byteLength };
    }
  }

  return {
    html: decodeWith(bytes, 'utf-8') ?? '',
    encoding: 'utf-8',
    usedBom: false,
    size: bytes.byteLength,
  };
}
