/**
 * Inline source plugin
 *
 * Inlines CSS, JavaScript, and images directly into HTML files.
 * Useful for reducing HTTP requests and creating self-contained pages.
 *
 * Ported from: _legacy/plugins/metalsmith-inline-source.js
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext } from '../types.js';

/**
 * Options for inline source plugin
 */
export interface InlineSourceOptions {
  /** File patterns to process (default: ['**\/*.html']) */
  pattern?: string[];
  /** Inline JavaScript (default: true) */
  js?: boolean;
  /** Inline CSS (default: true) */
  css?: boolean;
  /** Inline images as base64 (default: true) */
  images?: boolean;
  /** Only inline files smaller than this size in bytes (default: 50000) */
  maxSize?: number;
}

// Regex patterns
const relativeUrlRe = /(?:url\(|<(?:link|script|img)[^>]+(?:src|href)\s*=\s*)(?!['"]?(?:data|http|\/\/))['"]?([^'")\s>]+)['"]?[^>;]*\/?(?:\)|>(<\/script>)?)/;
const javaScriptRe = /<script/;
const cssRe = /rel\s*=\s*["']{1}stylesheet["']{1}/;
const imgRe = /(<img|url\()/;

/**
 * Simple pattern matching
 */
function matchPattern(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\{\{GLOBSTAR\}\}/g, '.*');

    if (new RegExp(`^${regex}$`).test(path)) {
      return true;
    }
  }
  return false;
}

/**
 * Get file extension from path
 */
function getExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot === -1 ? '' : path.substring(lastDot + 1).toLowerCase();
}

/**
 * Get MIME type for image extension
 */
function getImageMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    avif: 'image/avif',
    ico: 'image/x-icon',
  };
  return mimeTypes[ext] ?? 'application/octet-stream';
}

/**
 * Convert bytes to base64
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Resolve a relative path from a file
 */
function resolvePath(fromPath: string, relativePath: string): string {
  if (relativePath.startsWith('/')) {
    // Absolute path from root
    return relativePath.substring(1);
  }

  // Get directory of the source file
  const lastSlash = fromPath.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : fromPath.substring(0, lastSlash);

  // Combine paths
  const parts = (dir ? dir + '/' + relativePath : relativePath).split('/');
  const result: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      result.pop();
    } else if (part !== '.' && part !== '') {
      result.push(part);
    }
  }

  return result.join('/');
}

/**
 * Create the inline source plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function inlineSource(options: InlineSourceOptions = {}): PipelinePlugin {
  const {
    pattern = ['**/*.html'],
    js = true,
    css = true,
    images = true,
    maxSize = 50000,
  } = options;

  return function inlineSourcePlugin(files: VirtualFileMap, context: PipelineContext): void {
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();

    for (const [path, file] of files) {
      if (!matchPattern(path, pattern)) {
        continue;
      }

      let html = decoder.decode(file.contents);
      let idx = 0;
      let match = html.match(relativeUrlRe);
      let changed = false;

      while (match) {
        const matchedUrl = match[1];
        if (!matchedUrl) {
          idx += match.index! + match[0].length;
          match = html.substring(idx).match(relativeUrlRe);
          continue;
        }

        // Resolve the file path
        const filePath = resolvePath(path, matchedUrl);
        const inlineFile = files.get(filePath);

        if (inlineFile && inlineFile.contents.length <= maxSize) {
          if (js && javaScriptRe.test(match[0])) {
            // Inline JavaScript
            const jsContent = decoder.decode(inlineFile.contents);
            const replacement = `<script type="text/javascript">${jsContent}</script>`;
            html = html.replace(match[0], replacement.replace(/\$/g, '$$$$'));
            idx += match.index! + replacement.length;
            changed = true;
            context.log(`inline-source: inlined JS ${filePath} into ${path}`, 'debug');
          } else if (css && cssRe.test(match[0])) {
            // Inline CSS
            const cssContent = decoder.decode(inlineFile.contents);
            const replacement = `<style>${cssContent}</style>`;
            html = html.replace(match[0], replacement);
            idx += match.index! + replacement.length;
            changed = true;
            context.log(`inline-source: inlined CSS ${filePath} into ${path}`, 'debug');
          } else if (images && imgRe.test(match[0])) {
            // Inline image as base64
            const ext = getExtension(filePath);
            const mimeType = getImageMimeType(ext);
            const base64 = bytesToBase64(inlineFile.contents);
            const dataUrl = `data:${mimeType};base64,${base64}`;
            html = html.replace(matchedUrl, dataUrl);
            changed = true;
            context.log(`inline-source: inlined image ${filePath} into ${path}`, 'debug');
          } else {
            // Skip this match
            idx += match.index! + match[0].length;
          }
        } else {
          // File not found or too large
          idx += match.index! + match[0].length;
        }

        match = html.substring(idx).match(relativeUrlRe);
      }

      if (changed) {
        file.contents = encoder.encode(html);
      }
    }
  };
}

export default inlineSource;
