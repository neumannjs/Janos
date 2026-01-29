/**
 * Filesystem utility functions
 */

/**
 * Normalize a path by resolving . and .. segments and converting separators
 * @param path - Path to normalize
 * @returns Normalized absolute path
 */
export function normalizePath(path: string): string {
  // Convert backslashes to forward slashes
  let normalized = path.replace(/\\/g, '/');

  // Remove trailing slashes (except for root)
  while (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  // Split into segments
  const segments = normalized.split('/');
  const result: string[] = [];

  for (const segment of segments) {
    if (segment === '..') {
      // Go up one level (but not past root)
      if (result.length > 1 || (result.length === 1 && result[0] !== '')) {
        result.pop();
      }
    } else if (segment !== '.' && segment !== '') {
      result.push(segment);
    } else if (segment === '' && result.length === 0) {
      // Preserve root
      result.push('');
    }
  }

  return result.join('/') || '/';
}

/**
 * Join path segments into a single path
 * @param segments - Path segments to join
 * @returns Joined path
 */
export function joinPath(...segments: string[]): string {
  if (segments.length === 0) return '.';

  let joined = '';
  for (const segment of segments) {
    if (segment.startsWith('/')) {
      // Absolute path resets
      joined = segment;
    } else if (joined === '' || joined.endsWith('/')) {
      joined += segment;
    } else {
      joined += '/' + segment;
    }
  }

  return normalizePath(joined);
}

/**
 * Get the directory name of a path
 * @param path - Path to get directory from
 * @returns Directory portion of the path
 */
export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf('/');

  if (lastSlash === -1) return '.';
  if (lastSlash === 0) return '/';

  return normalized.slice(0, lastSlash);
}

/**
 * Get the base name (filename) of a path
 * @param path - Path to get basename from
 * @param ext - Optional extension to remove
 * @returns Filename portion of the path
 */
export function basename(path: string, ext?: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf('/');
  let name = lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);

  if (ext && name.endsWith(ext)) {
    name = name.slice(0, -ext.length);
  }

  return name;
}

/**
 * Get the extension of a path
 * @param path - Path to get extension from
 * @returns Extension including the dot, or empty string if none
 */
export function extname(path: string): string {
  const base = basename(path);
  const dotIndex = base.lastIndexOf('.');

  if (dotIndex === -1 || dotIndex === 0) return '';
  return base.slice(dotIndex);
}

/**
 * Check if a path is absolute
 * @param path - Path to check
 * @returns true if absolute
 */
export function isAbsolute(path: string): boolean {
  return path.startsWith('/');
}

/**
 * Get relative path from one location to another
 * @param from - Starting path
 * @param to - Target path
 * @returns Relative path
 */
export function relative(from: string, to: string): string {
  const fromParts = normalizePath(from).split('/').filter(Boolean);
  const toParts = normalizePath(to).split('/').filter(Boolean);

  // Find common prefix
  let commonLength = 0;
  const minLength = Math.min(fromParts.length, toParts.length);

  while (commonLength < minLength && fromParts[commonLength] === toParts[commonLength]) {
    commonLength++;
  }

  // Build relative path
  const upCount = fromParts.length - commonLength;
  const ups = Array.from({ length: upCount }, () => '..');
  const downs = toParts.slice(commonLength);

  const result = [...ups, ...downs].join('/');
  return result || '.';
}

/**
 * Parse a path into its components
 * @param path - Path to parse
 * @returns Object with root, dir, base, ext, and name
 */
export function parsePath(path: string): {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
} {
  const normalized = normalizePath(path);
  const root = normalized.startsWith('/') ? '/' : '';
  const dir = dirname(normalized);
  const base = basename(normalized);
  const ext = extname(normalized);
  const name = basename(normalized, ext);

  return { root, dir, base, ext, name };
}

/**
 * Text encoder for string to Uint8Array conversion
 */
const textEncoder = new TextEncoder();

/**
 * Text decoder for Uint8Array to string conversion
 */
const textDecoder = new TextDecoder();

/**
 * Convert a string to Uint8Array using UTF-8 encoding
 * @param str - String to encode
 * @returns Encoded bytes
 */
export function stringToBytes(str: string): Uint8Array {
  return textEncoder.encode(str);
}

/**
 * Convert Uint8Array to string using UTF-8 decoding
 * @param bytes - Bytes to decode
 * @returns Decoded string
 */
export function bytesToString(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

/**
 * Convert Uint8Array to base64 string
 * @param bytes - Bytes to encode
 * @returns Base64 encoded string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  // Use built-in btoa with proper byte handling
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 * @param base64 - Base64 encoded string
 * @returns Decoded bytes
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
