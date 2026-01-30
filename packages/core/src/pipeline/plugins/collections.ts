/**
 * Collections plugin
 *
 * Groups files into collections based on patterns or metadata.
 * Similar to metalsmith-collections.
 *
 * Collections can be defined by:
 * 1. Pattern matching (glob patterns like "posts/**\/*.md")
 * 2. Metadata matching (files with `collection: "name"` in frontmatter)
 *
 * Collections are sorted and made available in:
 * - context.metadata.collections (for templates)
 * - Each file's metadata.collection (name of collection it belongs to)
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext, VirtualFile } from '../types.js';

/**
 * Configuration for a single collection
 */
export interface CollectionConfig {
  /** Glob pattern(s) to match files */
  pattern?: string | string[];
  /** Metadata field to sort by (default: 'date') */
  sortBy?: string;
  /** Reverse sort order (default: false) */
  reverse?: boolean;
  /** Whether to add back-references from files to collection (default: true) */
  refer?: boolean;
  /** Limit number of items in collection */
  limit?: number;
  /** Filter function for additional filtering */
  filter?: (file: VirtualFile, path: string) => boolean;
}

/**
 * Options for collections plugin
 */
export interface CollectionsOptions {
  /** Collection configurations keyed by collection name */
  [collectionName: string]: CollectionConfig;
}

/**
 * Collection item with file reference and path
 */
export interface CollectionItem {
  /** File path */
  path: string;
  /** File metadata */
  [key: string]: unknown;
}

/**
 * Simple glob pattern matching
 * Supports: *, **, ?
 *
 * Examples:
 * - posts/*.md matches posts/file.md but not posts/dir/file.md
 * - posts/**\/*.md matches posts/file.md, posts/dir/file.md, posts/a/b/file.md
 * - **\/*.md matches any .md file at any depth
 */
function matchPattern(path: string, pattern: string): boolean {
  // Convert glob to regex
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars except * and ?
    .replace(/\*\*\//g, '{{GLOBSTAR_SLASH}}') // **/ -> match zero or more dirs
    .replace(/\*\*/g, '{{GLOBSTAR}}') // ** at end -> match anything
    .replace(/\*/g, '[^/]*') // * -> match within segment
    .replace(/\?/g, '[^/]') // ? -> match single char
    .replace(/\{\{GLOBSTAR_SLASH\}\}/g, '(?:.*\\/)?') // **/ -> optional dirs with trailing slash
    .replace(/\{\{GLOBSTAR\}\}/g, '.*'); // ** -> match anything

  return new RegExp(`^${regex}$`).test(path);
}

/**
 * Check if file matches any of the patterns
 */
function matchesPatterns(path: string, patterns: string | string[]): boolean {
  const patternList = Array.isArray(patterns) ? patterns : [patterns];
  return patternList.some(pattern => matchPattern(path, pattern));
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Compare function for sorting
 */
function compareBy(sortBy: string, reverse: boolean) {
  return (a: CollectionItem, b: CollectionItem): number => {
    const aVal = getNestedValue(a as Record<string, unknown>, sortBy);
    const bVal = getNestedValue(b as Record<string, unknown>, sortBy);

    let result = 0;

    if (aVal === undefined && bVal === undefined) {
      result = 0;
    } else if (aVal === undefined) {
      result = 1;
    } else if (bVal === undefined) {
      result = -1;
    } else if (aVal instanceof Date && bVal instanceof Date) {
      result = aVal.getTime() - bVal.getTime();
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      result = aVal - bVal;
    } else if (typeof aVal === 'string' && typeof bVal === 'string') {
      result = aVal.localeCompare(bVal);
    } else {
      // Convert to string for comparison
      result = String(aVal).localeCompare(String(bVal));
    }

    return reverse ? -result : result;
  };
}

/**
 * Create the collections plugin
 * @param options - Collection configurations
 * @returns Pipeline plugin
 */
export function collections(options: CollectionsOptions = {}): PipelinePlugin {
  return async function collectionsPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    const decoder = new TextDecoder('utf-8');

    // Initialize collections map
    const collectionsMap: Record<string, CollectionItem[]> = {};

    // Initialize empty arrays for all configured collections
    for (const collectionName of Object.keys(options)) {
      collectionsMap[collectionName] = [];
    }

    // First pass: collect files into collections
    for (const [path, file] of files) {
      // Ensure file has metadata object
      if (!file.metadata) {
        file.metadata = {};
      }

      // Check metadata-based collection assignment
      const metadataCollection = file.metadata['collection'] as string | string[] | undefined;

      if (metadataCollection) {
        const collectionNames = Array.isArray(metadataCollection)
          ? metadataCollection
          : [metadataCollection];

        for (const collectionName of collectionNames) {
          // Ensure collection exists
          if (!collectionsMap[collectionName]) {
            collectionsMap[collectionName] = [];
          }

          const config = options[collectionName] || {};

          // Apply filter if specified
          if (config.filter && !config.filter(file, path)) {
            continue;
          }

          // Create collection item with file metadata
          const item: CollectionItem = {
            path,
            ...file.metadata,
            // Include contents as string for excerpt access
            contents: decoder.decode(file.contents),
          };

          collectionsMap[collectionName].push(item);

          // Add collection reference to file if refer is not false
          if (config.refer !== false) {
            if (!file.metadata['collections']) {
              file.metadata['collections'] = [];
            }
            (file.metadata['collections'] as string[]).push(collectionName);
          }
        }
      }

      // Check pattern-based collection assignment
      for (const [collectionName, config] of Object.entries(options)) {
        if (!config.pattern) {
          continue;
        }

        if (matchesPatterns(path, config.pattern)) {
          // Apply filter if specified
          if (config.filter && !config.filter(file, path)) {
            continue;
          }

          // Check if already added via metadata
          const collection = collectionsMap[collectionName];
          if (!collection) {
            continue;
          }
          const existingItem = collection.find(item => item.path === path);
          if (existingItem) {
            continue;
          }

          // Create collection item
          const item: CollectionItem = {
            path,
            ...file.metadata,
            contents: decoder.decode(file.contents),
          };

          collection.push(item);

          // Add collection reference to file if refer is not false
          if (config.refer !== false) {
            if (!file.metadata['collections']) {
              file.metadata['collections'] = [];
            }
            const fileCollections = file.metadata['collections'] as string[];
            if (!fileCollections.includes(collectionName)) {
              fileCollections.push(collectionName);
            }

            // Also set primary collection if not already set
            if (!file.metadata['collection']) {
              file.metadata['collection'] = collectionName;
            }
          }
        }
      }
    }

    // Second pass: sort collections and apply limits
    for (const [collectionName, config] of Object.entries(options)) {
      const collection = collectionsMap[collectionName];

      if (!collection || collection.length === 0) {
        continue;
      }

      // Sort
      const sortBy = config.sortBy || 'date';
      const reverse = config.reverse ?? false;
      collection.sort(compareBy(sortBy, reverse));

      // Apply limit
      if (config.limit && config.limit > 0) {
        const limited = collection.slice(0, config.limit);
        collectionsMap[collectionName] = limited;
        context.log(
          `collections: '${collectionName}' has ${limited.length} items`,
          'debug'
        );
      } else {
        context.log(
          `collections: '${collectionName}' has ${collection.length} items`,
          'debug'
        );
      }
    }

    // Add collections to context metadata for template access
    context.metadata['collections'] = collectionsMap;

    context.log(
      `collections: created ${Object.keys(collectionsMap).length} collections`,
      'info'
    );
  };
}

export default collections;
