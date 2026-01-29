/**
 * CSS URL rewriting plugin
 *
 * Rewrites absolute URLs in CSS files to include the site's root path.
 * Useful for deploying to subdirectories (e.g., GitHub Pages project sites).
 *
 * Ported from: _legacy/plugins/metalsmith-css-change-url.js
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext } from '../types.js';

/**
 * Options for CSS URL plugin
 */
export interface CssUrlsOptions {
  /** File patterns to process (default: ['**\/*.css']) */
  pattern?: string[];
}

/**
 * Simple pattern matching (supports * and ** wildcards)
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
 * Create the CSS URLs plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function cssUrls(options: CssUrlsOptions = {}): PipelinePlugin {
  const { pattern = ['**/*.css'] } = options;

  return function cssUrlsPlugin(files: VirtualFileMap, context: PipelineContext): void {
    const rootPath = (context.metadata.site as Record<string, unknown>)?.['rootpath'] as string | undefined;

    // Skip if rootpath is not set or is just '/'
    if (!rootPath || rootPath === '/') {
      context.log('css-urls: rootpath is "/" or not set, skipping', 'debug');
      return;
    }

    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();

    for (const [path, file] of files) {
      if (!matchPattern(path, pattern)) {
        continue;
      }

      context.log(`css-urls: processing ${path}`, 'debug');

      const content = decoder.decode(file.contents);

      // Replace url(/ with url(<rootpath>
      const updated = content.replace(/url\(\//g, `url(${rootPath}`);

      if (updated !== content) {
        file.contents = encoder.encode(updated);
        context.log(`css-urls: rewrote URLs in ${path}`, 'debug');
      }
    }
  };
}

export default cssUrls;
