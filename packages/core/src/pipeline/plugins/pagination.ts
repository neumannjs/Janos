/**
 * Pagination plugin
 *
 * Paginates collections and creates virtual page files.
 * Similar to metalsmith-pagination.
 *
 * Creates pages with pagination metadata accessible in templates:
 * - pagination.files: items on current page
 * - pagination.pages: all page objects
 * - pagination.next: next page (or null)
 * - pagination.previous: previous page (or null)
 * - pagination.current: current page number (1-indexed)
 * - pagination.total: total number of pages
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext, VirtualFile, FileMetadata } from '../types.js';

/**
 * Configuration for paginating a single collection
 */
export interface PaginationConfig {
  /** Number of items per page (default: 10) */
  perPage?: number;
  /** Path for the first page (e.g., 'index.html') */
  first?: string;
  /** Path pattern for pages with :num placeholder (e.g., 'posts/:num/index.html') */
  path: string;
  /** Layout template to use for pages */
  layout?: string;
  /** If true, don't create separate file for page 1 (use 'first' path) */
  noPageOne?: boolean;
  /** Additional metadata to add to each page */
  pageMetadata?: FileMetadata;
  /** Filter function for items */
  filter?: (item: unknown) => boolean;
}

/**
 * Options for pagination plugin
 * Keys are collection references like 'collections.posts'
 */
export interface PaginationOptions {
  [collectionRef: string]: PaginationConfig;
}

/**
 * Page object available in templates
 */
export interface PageInfo {
  /** Page number (1-indexed) */
  num: number;
  /** Path to this page */
  path: string;
}

/**
 * Pagination data available in templates
 */
export interface PaginationData {
  /** Items on this page */
  files: unknown[];
  /** All pages */
  pages: PageInfo[];
  /** Current page number */
  current: number;
  /** Total number of pages */
  total: number;
  /** Next page (or null) */
  next: PageInfo | null;
  /** Previous page (or null) */
  previous: PageInfo | null;
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
 * Create the pagination plugin
 * @param options - Pagination configurations keyed by collection reference
 * @returns Pipeline plugin
 */
export function pagination(options: PaginationOptions = {}): PipelinePlugin {
  return async function paginationPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    const encoder = new TextEncoder();

    for (const [collectionRef, config] of Object.entries(options)) {
      // Get the collection from context.metadata
      // collectionRef is like 'collections.posts'
      const collection = getNestedValue(
        context.metadata as Record<string, unknown>,
        collectionRef
      ) as unknown[] | undefined;

      if (!collection || !Array.isArray(collection)) {
        context.log(
          `pagination: collection '${collectionRef}' not found or empty`,
          'warn'
        );
        continue;
      }

      // Apply filter if specified
      let items = collection;
      if (config.filter) {
        items = items.filter(config.filter);
      }

      const perPage = config.perPage ?? 10;
      const totalPages = Math.ceil(items.length / perPage);

      if (totalPages === 0) {
        context.log(
          `pagination: collection '${collectionRef}' has no items`,
          'debug'
        );
        continue;
      }

      // Build all page info objects first
      const pages: PageInfo[] = [];
      for (let i = 0; i < totalPages; i++) {
        const pageNum = i + 1;
        let pagePath: string;

        if (pageNum === 1 && config.first) {
          pagePath = config.first;
        } else if (pageNum === 1 && config.noPageOne && config.first) {
          pagePath = config.first;
        } else {
          pagePath = config.path.replace(':num', String(pageNum));
        }

        pages.push({
          num: pageNum,
          path: pagePath,
        });
      }

      // Create page files
      for (let i = 0; i < totalPages; i++) {
        const pageNum = i + 1;
        const pageInfo = pages[i]!;
        const startIndex = i * perPage;
        const pageItems = items.slice(startIndex, startIndex + perPage);

        // Build pagination data for template
        const paginationData: PaginationData = {
          files: pageItems,
          pages,
          current: pageNum,
          total: totalPages,
          next: i < totalPages - 1 ? pages[i + 1]! : null,
          previous: i > 0 ? pages[i - 1]! : null,
        };

        // Determine if we should create this page file
        // If noPageOne is true and this is page 1, we still create the file at 'first' path
        const shouldCreate = !(config.noPageOne && pageNum > 1 && pageNum === 1);

        if (shouldCreate || pageNum > 1 || !config.noPageOne) {
          // Build metadata for the page
          const metadata: FileMetadata = {
            ...config.pageMetadata,
            pagination: paginationData,
          };

          if (config.layout) {
            metadata.layout = config.layout;
          }

          // Create virtual file for this page
          const file: VirtualFile = {
            path: pageInfo.path,
            contents: encoder.encode(''), // Empty content, layout will render
            metadata,
            sourcePath: `pagination:${collectionRef}:${pageNum}`,
          };

          files.set(pageInfo.path, file);

          context.log(
            `pagination: created ${pageInfo.path} (page ${pageNum}/${totalPages}, ${pageItems.length} items)`,
            'debug'
          );
        }
      }

      context.log(
        `pagination: created ${totalPages} pages for '${collectionRef}'`,
        'info'
      );
    }
  };
}

export default pagination;
