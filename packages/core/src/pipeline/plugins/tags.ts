/**
 * Tags plugin
 *
 * Transforms tag metadata from strings to structured objects with name and slug.
 * This makes it easier to generate tag pages and links in templates.
 *
 * Input:  tags: ["JavaScript", "Web Dev", "TypeScript"]
 * Output: tags: [
 *   { name: "JavaScript", slug: "javascript" },
 *   { name: "Web Dev", slug: "web-dev" },
 *   { name: "TypeScript", slug: "typescript" }
 * ]
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext } from '../types.js';

/**
 * Structured tag object
 */
export interface Tag {
  /** Original tag name */
  name: string;
  /** URL-friendly slug */
  slug: string;
}

/**
 * Options for tags plugin
 */
export interface TagsOptions {
  /** Metadata field containing tags (default: 'tags') */
  field?: string;
  /** Additional fields to transform (e.g., ['categories', 'topics']) */
  additionalFields?: string[];
  /** Custom slug function */
  slugify?: (text: string) => string;
  /** Whether to collect all unique tags in context.metadata.allTags */
  collectAll?: boolean;
}

/**
 * Default slug function
 */
function defaultSlugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')  // Remove non-word chars
    .replace(/\s+/g, '-')       // Replace spaces with hyphens
    .replace(/-+/g, '-')        // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '');   // Trim hyphens from ends
}

/**
 * Transform a tag value to a Tag object
 */
function transformTag(value: unknown, slugify: (text: string) => string): Tag | null {
  if (typeof value === 'string') {
    const name = value.trim();
    if (!name) return null;
    return { name, slug: slugify(name) };
  }

  // Already an object with name
  if (value && typeof value === 'object' && 'name' in value) {
    const obj = value as { name: unknown; slug?: unknown };
    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (!name) return null;
    const slug = typeof obj.slug === 'string' ? obj.slug : slugify(name);
    return { name, slug };
  }

  return null;
}

/**
 * Transform tags array or single tag
 */
function transformTags(value: unknown, slugify: (text: string) => string): Tag[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map(item => transformTag(item, slugify))
      .filter((tag): tag is Tag => tag !== null);
  }

  const single = transformTag(value, slugify);
  return single ? [single] : [];
}

/**
 * Create the tags plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function tags(options: TagsOptions = {}): PipelinePlugin {
  const {
    field = 'tags',
    additionalFields = [],
    slugify = defaultSlugify,
    collectAll = true,
  } = options;

  const fieldsToTransform = [field, ...additionalFields];

  return async function tagsPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    // Map to collect all unique tags across all files
    const allTagsMap = new Map<string, Tag>();

    let transformedCount = 0;

    for (const [path, file] of files) {
      let fileTransformed = false;

      for (const fieldName of fieldsToTransform) {
        const value = file.metadata[fieldName];
        if (value !== undefined) {
          const transformed = transformTags(value, slugify);
          if (transformed.length > 0) {
            file.metadata[fieldName] = transformed;
            fileTransformed = true;

            // Collect unique tags
            if (collectAll) {
              for (const tag of transformed) {
                if (!allTagsMap.has(tag.slug)) {
                  allTagsMap.set(tag.slug, tag);
                }
              }
            }
          }
        }
      }

      if (fileTransformed) {
        transformedCount++;
      }
    }

    // Store all unique tags in context metadata
    if (collectAll) {
      const allTags = Array.from(allTagsMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      context.metadata.allTags = allTags;
      context.log(`tags: collected ${allTags.length} unique tags`, 'debug');
    }

    context.log(`tags: transformed ${transformedCount} files`, 'info');
  };
}

export default tags;
