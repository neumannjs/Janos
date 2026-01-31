/**
 * Tag Pages plugin
 *
 * Generates pages for each unique tag found in content.
 * Works in conjunction with the tags plugin which transforms tag strings to objects.
 *
 * For each tag, generates a page listing all content with that tag.
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext, VirtualFile } from '../types.js';

/**
 * Tag object (from tags plugin)
 */
interface Tag {
  name: string;
  slug: string;
}

/**
 * Options for tag-pages plugin
 */
export interface TagPagesOptions {
  /** Metadata field containing tags (default: 'tags') */
  field?: string;
  /** Layout template for tag pages */
  layout: string;
  /** Path pattern for tag pages (default: 'topics/:tag/index.html') */
  path?: string;
  /** Page title pattern (default: 'Posts tagged ":tag"') */
  title?: string;
  /** Sort items by this field (default: 'date') */
  sortBy?: string;
  /** Reverse sort order (default: true - newest first) */
  reverse?: boolean;
  /** Additional metadata for generated pages */
  pageMetadata?: Record<string, unknown>;
  /** Pagination options */
  pagination?: {
    /** Items per page */
    perPage: number;
    /** Path pattern for paginated pages (default: 'topics/:tag/:num/index.html') */
    path?: string;
  };
}

/**
 * Default slug function (fallback if tag is a string)
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Get tag info from a tag value
 */
function getTagInfo(tag: unknown): Tag | null {
  if (typeof tag === 'string') {
    const name = tag.trim();
    if (!name) return null;
    return { name, slug: slugify(name) };
  }

  if (tag && typeof tag === 'object' && 'name' in tag && 'slug' in tag) {
    const t = tag as Tag;
    return { name: t.name, slug: t.slug };
  }

  return null;
}

/**
 * Sort function for items
 */
function sortItems(
  items: Array<Record<string, unknown>>,
  sortBy: string,
  reverse: boolean
): Array<Record<string, unknown>> {
  return [...items].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    let comparison = 0;

    if (aVal instanceof Date && bVal instanceof Date) {
      comparison = aVal.getTime() - bVal.getTime();
    } else if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal ?? '').localeCompare(String(bVal ?? ''));
    }

    return reverse ? -comparison : comparison;
  });
}

/**
 * Create the tag-pages plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function tagPages(options: TagPagesOptions): PipelinePlugin {
  const {
    field = 'tags',
    layout,
    path: pathPattern = 'topics/:tag/index.html',
    title: titlePattern = 'Posts tagged ":tag"',
    sortBy = 'date',
    reverse = true,
    pageMetadata = {},
    pagination,
  } = options;

  if (!layout) {
    throw new Error('tagPages: layout option is required');
  }

  return async function tagPagesPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    const encoder = new TextEncoder();

    // Collect items by tag
    const tagItems = new Map<string, { tag: Tag; items: Array<Record<string, unknown>> }>();

    for (const [filePath, file] of files) {
      const tags = file.metadata[field];
      if (!tags) continue;

      const tagArray = Array.isArray(tags) ? tags : [tags];

      for (const tagValue of tagArray) {
        const tag = getTagInfo(tagValue);
        if (!tag) continue;

        if (!tagItems.has(tag.slug)) {
          tagItems.set(tag.slug, { tag, items: [] });
        }

        // Create item reference with file metadata
        const item: Record<string, unknown> = {
          ...file.metadata,
          path: filePath,
          sourcePath: file.sourcePath,
        };

        tagItems.get(tag.slug)!.items.push(item);
      }
    }

    let pageCount = 0;

    for (const [tagSlug, { tag, items }] of tagItems) {
      // Sort items
      const sortedItems = sortItems(items, sortBy, reverse);

      if (pagination && pagination.perPage > 0) {
        // Generate paginated pages
        const perPage = pagination.perPage;
        const totalPages = Math.ceil(sortedItems.length / perPage);
        const paginatedPath = pagination.path || 'topics/:tag/:num/index.html';

        // Build pages array first (same format as pagination plugin)
        const pages: Array<{ num: number; path: string }> = [];
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const pagePath = pageNum === 1
            ? pathPattern.replace(':tag', tagSlug)
            : paginatedPath.replace(':tag', tagSlug).replace(':num', String(pageNum));
          pages.push({ num: pageNum, path: pagePath });
        }

        for (let i = 0; i < totalPages; i++) {
          const pageNum = i + 1;
          const pageInfo = pages[i]!;
          const startIndex = i * perPage;
          const pageItems = sortedItems.slice(startIndex, startIndex + perPage);

          // Match pagination plugin format exactly
          const paginationData = {
            files: pageItems,
            pages,
            current: pageNum,
            total: totalPages,
            next: i < totalPages - 1 ? pages[i + 1]! : null,
            previous: i > 0 ? pages[i - 1]! : null,
          };

          const pageFile: VirtualFile = {
            path: pageInfo.path,
            contents: encoder.encode(''), // Content comes from layout
            metadata: {
              ...pageMetadata,
              layout,
              title: titlePattern.replace(':tag', tag.name),
              tag: tag.name, // Just the tag name string for templates
              tagSlug,
              tagInfo: tag, // Full tag object if needed
              pagination: paginationData,
            },
            sourcePath: pageInfo.path,
          };

          files.set(pageInfo.path, pageFile);
          pageCount++;
        }
      } else {
        // Generate single page per tag (with pagination structure for consistency)
        const pagePath = pathPattern.replace(':tag', tagSlug);
        const pages = [{ num: 1, path: pagePath }];

        const paginationData = {
          files: sortedItems,
          pages,
          current: 1,
          total: 1,
          next: null,
          previous: null,
        };

        const pageFile: VirtualFile = {
          path: pagePath,
          contents: encoder.encode(''),
          metadata: {
            ...pageMetadata,
            layout,
            title: titlePattern.replace(':tag', tag.name),
            tag: tag.name,
            tagSlug,
            tagInfo: tag,
            pagination: paginationData,
          },
          sourcePath: pagePath,
        };

        files.set(pagePath, pageFile);
        pageCount++;
      }
    }

    // Store all tags in context for use in templates (e.g., tag cloud)
    const allTags = Array.from(tagItems.entries()).map(([slug, { tag, items }]) => ({
      ...tag,
      count: items.length,
    })).sort((a, b) => a.name.localeCompare(b.name));

    context.metadata.tagPages = allTags;

    context.log(`tag-pages: generated ${pageCount} pages for ${tagItems.size} tags`, 'info');
  };
}

export default tagPages;
