/**
 * Publish plugin
 *
 * Filters out files that shouldn't be published based on their metadata:
 * - draft: true - Work in progress, not ready for publication
 * - private: true - Personal content, not for public viewing
 * - date > now - Future-dated content (scheduled posts)
 *
 * In development mode, these files can optionally be included for preview.
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext } from '../types.js';

/**
 * Options for publish plugin
 */
export interface PublishOptions {
  /** Include draft posts (default: false in production, true in development) */
  draft?: boolean;
  /** Include private posts (default: false) */
  private?: boolean;
  /** Include future-dated posts (default: false in production, true in development) */
  future?: boolean;
  /** Metadata field containing the date (default: 'date') */
  dateField?: string;
  /** Metadata field for draft status (default: 'draft') */
  draftField?: string;
  /** Metadata field for private status (default: 'private') */
  privateField?: string;
  /**
   * Metadata field for publish status (default: 'publish')
   * Supports values like 'draft', 'private', 'published'
   * This is an alternative to separate draft/private boolean fields
   */
  publishField?: string;
  /** File patterns to check (default: all files) */
  pattern?: string[];
}

/**
 * Simple pattern matching
 */
function matchPattern(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    let regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace('{{GLOBSTAR}}/', '(.*\\/)?');

    regex = regex.replace(/\{\{GLOBSTAR\}\}/g, '.*');

    if (new RegExp(`^${regex}$`).test(path)) {
      return true;
    }
  }
  return false;
}

/**
 * Create the publish plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function publish(options: PublishOptions = {}): PipelinePlugin {
  const {
    dateField = 'date',
    draftField = 'draft',
    privateField = 'private',
    publishField = 'publish',
    pattern,
  } = options;

  return async function publishPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    const isDev = context.mode === 'development';

    // Determine what to include based on mode and options
    const includeDraft = options.draft ?? isDev;
    const includePrivate = options.private ?? false;
    const includeFuture = options.future ?? isDev;

    const now = new Date();
    const filesToRemove: string[] = [];

    let draftCount = 0;
    let privateCount = 0;
    let futureCount = 0;

    for (const [path, file] of files) {
      // Skip files that don't match the pattern
      if (pattern && !matchPattern(path, pattern)) {
        continue;
      }

      const metadata = file.metadata;

      // Check draft status
      // Supports both `draft: true` and `publish: draft` conventions
      const publishValue = metadata[publishField];
      const isDraft = metadata[draftField] === true || publishValue === 'draft';
      if (isDraft && !includeDraft) {
        filesToRemove.push(path);
        draftCount++;
        context.log(`publish: filtering draft: ${path}`, 'debug');
        continue;
      }

      // Check private status
      // Supports both `private: true` and `publish: private` conventions
      const isPrivate = metadata[privateField] === true || publishValue === 'private';
      if (isPrivate && !includePrivate) {
        filesToRemove.push(path);
        privateCount++;
        context.log(`publish: filtering private: ${path}`, 'debug');
        continue;
      }

      // Check future date
      if (!includeFuture) {
        const dateValue = metadata[dateField];
        if (dateValue) {
          const postDate = dateValue instanceof Date ? dateValue : new Date(dateValue as string | number);
          if (!isNaN(postDate.getTime()) && postDate > now) {
            filesToRemove.push(path);
            futureCount++;
            context.log(`publish: filtering future (${postDate.toISOString()}): ${path}`, 'debug');
            continue;
          }
        }
      }
    }

    // Remove filtered files
    for (const path of filesToRemove) {
      files.delete(path);
    }

    const totalFiltered = draftCount + privateCount + futureCount;
    if (totalFiltered > 0) {
      const parts: string[] = [];
      if (draftCount > 0) parts.push(`${draftCount} drafts`);
      if (privateCount > 0) parts.push(`${privateCount} private`);
      if (futureCount > 0) parts.push(`${futureCount} future`);
      context.log(`publish: filtered ${totalFiltered} files (${parts.join(', ')})`, 'info');
    } else {
      context.log('publish: no files filtered', 'debug');
    }
  };
}

export default publish;
