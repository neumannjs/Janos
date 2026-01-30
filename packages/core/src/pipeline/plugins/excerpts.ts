/**
 * Excerpts plugin
 *
 * Extracts excerpts from file content using a marker (default: <!-- more -->).
 * Similar to metalsmith-more / metalsmith-excerpts.
 *
 * The excerpt is the content before the marker, stored in file metadata.
 * Useful for showing previews on listing pages.
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext } from '../types.js';

/**
 * Options for excerpts plugin
 */
export interface ExcerptsOptions {
  /** Metadata key to store excerpt (default: 'excerpt') */
  key?: string;
  /** Marker to split on (default: '<!-- more -->') */
  marker?: string;
  /** File patterns to process (default: ['**\/*.html']) */
  pattern?: string[];
  /** Remove marker from content (default: true) */
  removeMarker?: boolean;
  /** Trim whitespace from excerpt (default: true) */
  trim?: boolean;
}

/**
 * Simple pattern matching (same as collections plugin)
 */
function matchPattern(path: string, pattern: string): boolean {
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '{{GLOBSTAR_SLASH}}')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR_SLASH\}\}/g, '(?:.*\\/)?')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  return new RegExp(`^${regex}$`).test(path);
}

function matchesPatterns(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => matchPattern(path, pattern));
}

/**
 * Create the excerpts plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function excerpts(options: ExcerptsOptions = {}): PipelinePlugin {
  const {
    key = 'excerpt',
    marker = '<!-- more -->',
    pattern = ['**/*.html'],
    removeMarker = true,
    trim = true,
  } = options;

  return async function excerptsPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();
    let extractedCount = 0;

    for (const [path, file] of files) {
      if (!matchesPatterns(path, pattern)) {
        continue;
      }

      const content = decoder.decode(file.contents);
      const markerIndex = content.indexOf(marker);

      if (markerIndex === -1) {
        // No marker found, skip
        continue;
      }

      // Extract excerpt (content before marker)
      let excerpt = content.substring(0, markerIndex);
      if (trim) {
        excerpt = excerpt.trim();
      }

      // Store excerpt in metadata
      if (!file.metadata) {
        file.metadata = {};
      }
      file.metadata[key] = excerpt;

      // Optionally remove marker from content
      if (removeMarker) {
        const newContent = content.substring(0, markerIndex) +
          content.substring(markerIndex + marker.length);
        file.contents = encoder.encode(trim ? newContent.trim() : newContent);
      }

      extractedCount++;
      context.log(`excerpts: extracted from ${path}`, 'debug');
    }

    if (extractedCount > 0) {
      context.log(`excerpts: extracted ${extractedCount} excerpts`, 'info');
    }
  };
}

export default excerpts;
