/**
 * Permalinks plugin
 *
 * Transforms file paths into clean URLs (e.g., /posts/my-post.html -> /posts/my-post/index.html).
 * Similar to metalsmith-permalinks.
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext, VirtualFile } from '../types.js';

/**
 * Options for permalinks plugin
 */
export interface PermalinksOptions {
  /** Pattern for generating permalinks. Use :property for substitution. */
  pattern?: string;
  /** File patterns to process (default: ['**\/*.html']) */
  match?: string[];
  /** Use trailing slash (default: true) */
  trailingSlash?: boolean;
  /** Index file name (default: 'index.html') */
  indexFile?: string;
  /** Custom slug function */
  slug?: (text: string) => string;
  /** Relative links (default: false) */
  relative?: boolean;
  /** Unique permalinks - append counter if duplicate */
  unique?: boolean;
}

/**
 * Simple pattern matching
 */
function matchPattern(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Handle **/*.ext pattern to match both root and nested files
    let regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\{\{GLOBSTAR\}\}\//, '(.*\\/)?'); // **/ matches zero or more directories

    // Handle remaining {{GLOBSTAR}} (for patterns like foo/**)
    regex = regex.replace(/\{\{GLOBSTAR\}\}/g, '.*');

    if (new RegExp(`^${regex}$`).test(path)) {
      return true;
    }
  }
  return false;
}

/**
 * Default slug function - converts text to URL-safe string
 */
function defaultSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/-+/g, '-'); // Collapse multiple hyphens
}

/**
 * Format a date for permalink
 */
function formatDate(date: Date, format: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');

  return format
    .replace('YYYY', date.getFullYear().toString())
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()));
}

/**
 * Substitute pattern placeholders with file metadata
 */
function substitutePattern(
  pattern: string,
  file: VirtualFile,
  originalPath: string,
  slugFn: (text: string) => string
): string {
  // Get filename without extension
  const lastSlash = originalPath.lastIndexOf('/');
  const filename = lastSlash === -1 ? originalPath : originalPath.substring(lastSlash + 1);
  const lastDot = filename.lastIndexOf('.');
  const basename = lastDot === -1 ? filename : filename.substring(0, lastDot);

  // Get directory
  const dir = lastSlash === -1 ? '' : originalPath.substring(0, lastSlash);

  return pattern.replace(/:(\w+)/g, (match, key) => {
    switch (key) {
      case 'basename':
        return slugFn(basename);
      case 'directory':
      case 'dir':
        return dir;
      case 'title':
        return slugFn(String(file.metadata.title ?? basename));
      case 'slug':
        return slugFn(String(file.metadata['slug'] ?? file.metadata['title'] ?? basename));
      case 'date':
      case 'year':
      case 'month':
      case 'day': {
        const date = file.metadata.date instanceof Date
          ? file.metadata.date
          : new Date(file.metadata.date as string | number | undefined ?? Date.now());

        if (key === 'date') return formatDate(date, 'YYYY/MM/DD');
        if (key === 'year') return date.getFullYear().toString();
        if (key === 'month') return (date.getMonth() + 1).toString().padStart(2, '0');
        if (key === 'day') return date.getDate().toString().padStart(2, '0');
        return match;
      }
      default: {
        // Try to get from metadata
        const value = file.metadata[key];
        if (value !== undefined && value !== null) {
          return slugFn(String(value));
        }
        return match;
      }
    }
  });
}

/**
 * Create the permalinks plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function permalinks(options: PermalinksOptions = {}): PipelinePlugin {
  const {
    pattern,
    match = ['**/*.html'],
    trailingSlash = true,
    indexFile = 'index.html',
    slug = defaultSlug,
    unique = true,
  } = options;

  return function permalinksPlugin(files: VirtualFileMap, context: PipelineContext): void {
    const usedPaths = new Set<string>();
    const toRename: Array<[string, string, VirtualFile]> = [];

    for (const [path, file] of files) {
      // Skip files that don't match
      if (!matchPattern(path, match)) {
        continue;
      }

      // Skip index files
      if (path.endsWith('/' + indexFile) || path === indexFile) {
        continue;
      }

      let newPath: string;

      // Check for custom permalink in frontmatter
      if (file.metadata.permalink) {
        newPath = String(file.metadata.permalink);
        if (!newPath.startsWith('/')) {
          newPath = '/' + newPath;
        }
      } else if (pattern) {
        // Use pattern substitution
        newPath = substitutePattern(pattern, file, path, slug);
      } else {
        // Default: remove extension
        const lastDot = path.lastIndexOf('.');
        newPath = lastDot === -1 ? path : path.substring(0, lastDot);
      }

      // Ensure path doesn't have leading slash for file map
      if (newPath.startsWith('/')) {
        newPath = newPath.substring(1);
      }

      // Add trailing slash and index file
      if (trailingSlash) {
        if (!newPath.endsWith('/')) {
          newPath += '/';
        }
        newPath += indexFile;
      } else if (!newPath.endsWith('.html')) {
        newPath += '.html';
      }

      // Handle duplicates
      if (unique && usedPaths.has(newPath)) {
        let counter = 1;
        let basePath = newPath.replace(/\/index\.html$/, '').replace(/\.html$/, '');
        while (usedPaths.has(`${basePath}-${counter}/${indexFile}`)) {
          counter++;
        }
        newPath = `${basePath}-${counter}/${indexFile}`;
      }

      usedPaths.add(newPath);
      toRename.push([path, newPath, file]);
    }

    // Apply renames
    for (const [oldPath, newPath, file] of toRename) {
      files.delete(oldPath);
      file.path = newPath;

      // Store the permalink in metadata (without index.html)
      const permalink = newPath.endsWith(indexFile)
        ? newPath.substring(0, newPath.length - indexFile.length)
        : newPath;
      file.metadata.permalink = '/' + permalink;

      files.set(newPath, file);
      context.log(`permalinks: ${oldPath} -> ${newPath}`, 'debug');
    }
  };
}

export default permalinks;
