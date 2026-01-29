/**
 * Webmentions plugin
 *
 * Fetches webmentions from webmention.io and adds them to file metadata.
 * Supports caching to avoid repeated API calls.
 *
 * Ported from: _legacy/plugins/metalsmith-webmentions.js
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext, VirtualFile } from '../types.js';

/**
 * Webmention data structure (JF2 format from webmention.io)
 */
export interface Webmention {
  'wm-id': number;
  'wm-source': string;
  'wm-target': string;
  'wm-property': 'in-reply-to' | 'like-of' | 'repost-of' | 'mention-of' | 'bookmark-of';
  'wm-received': string;
  author?: {
    name?: string;
    photo?: string;
    url?: string;
  };
  content?: {
    text?: string;
    html?: string;
  };
  published?: string;
  url?: string;
}

/**
 * Webmentions cache structure
 */
export interface WebmentionsCache {
  lastWmId: number | null;
  children: Webmention[];
  'reply-count'?: number;
  'like-count'?: number;
  'repost-count'?: number;
}

/**
 * Options for webmentions plugin
 */
export interface WebmentionsOptions {
  /** Base URL of the site */
  baseUrl: string;
  /** Domain registered with webmention.io (optional, derived from baseUrl) */
  domain?: string;
  /** Cache directory path (default: 'cache') */
  cacheDir?: string;
  /** Number of mentions to fetch per request (default: 10000) */
  perPage?: number;
  /** Custom fetch function (for testing or different environments) */
  fetch?: typeof globalThis.fetch;
  /** Function to read cache */
  readCache?: (path: string) => Promise<WebmentionsCache | null>;
  /** Function to write cache */
  writeCache?: (path: string, data: WebmentionsCache) => Promise<void>;
}

const API = 'https://webmention.io/api';

/**
 * Fetch webmentions from webmention.io API
 */
async function fetchWebmentions(
  url: string,
  lastWmId: number | null,
  perPage: number,
  fetchFn: typeof fetch
): Promise<{ children: Webmention[] } | null> {
  let requestUrl = `${API}/mentions.jf2?target=${encodeURIComponent(url)}&per-page=${perPage}`;
  if (lastWmId) {
    requestUrl += `&since_id=${lastWmId}`;
  }

  try {
    const response = await fetchFn(requestUrl);
    if (response.ok) {
      const data = await response.json() as { children: Webmention[] };
      return data;
    }
  } catch (error) {
    // Silently fail - webmentions are optional
    console.warn('Failed to fetch webmentions:', error);
  }

  return null;
}

/**
 * Merge fresh webmentions with cached entries, unique by wm-id
 */
function mergeWebmentions(cached: Webmention[], fresh: Webmention[]): Webmention[] {
  const byId = new Map<number, Webmention>();

  for (const wm of cached) {
    byId.set(wm['wm-id'], wm);
  }
  for (const wm of fresh) {
    byId.set(wm['wm-id'], wm);
  }

  return Array.from(byId.values());
}

/**
 * Count webmentions by property type
 */
function countByProperty(mentions: Webmention[], property: string): number {
  return mentions.filter((m) => m['wm-property'] === property).length;
}

/**
 * Check if a file should have webmentions fetched
 * (files with layout and collection properties - content pages)
 */
function shouldFetchWebmentions(file: VirtualFile): boolean {
  return Boolean(file.metadata['layout'] && file.metadata['collection']);
}

/**
 * Get the URL path for a file
 */
function getFilePath(file: VirtualFile): string {
  // Use permalink if available, otherwise use path
  const permalink = file.metadata.permalink as string | undefined;
  if (permalink) {
    return permalink;
  }

  // Convert path to URL path (remove extension, add trailing slash)
  let path = file.path;
  const extIndex = path.lastIndexOf('.');
  if (extIndex !== -1) {
    path = path.substring(0, extIndex);
  }
  if (path !== '' && !path.endsWith('/')) {
    path += '/';
  }
  return path;
}

/**
 * Create the webmentions plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function webmentions(options: WebmentionsOptions): PipelinePlugin {
  const {
    baseUrl,
    cacheDir = 'cache',
    perPage = 10000,
    fetch: fetchFn = globalThis.fetch,
    readCache,
    writeCache,
  } = options;

  // Ensure baseUrl ends with /
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';

  return async function webmentionsPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [, file] of files) {
      if (!shouldFetchWebmentions(file)) {
        continue;
      }

      const filePath = getFilePath(file);
      const fullUrl = normalizedBaseUrl + filePath;

      promises.push(
        (async () => {
          // Try to read from cache
          let cache: WebmentionsCache = {
            lastWmId: null,
            children: [],
          };

          if (readCache) {
            const cached = await readCache(`${cacheDir}/${filePath}webmentions.json`);
            if (cached) {
              cache = cached;
            }
          }

          // Set initial webmentions from cache
          file.metadata['webmentions'] = cache;

          // Fetch new webmentions
          const feed = await fetchWebmentions(fullUrl, cache.lastWmId, perPage, fetchFn);

          if (feed && feed.children.length > 0) {
            const newLastWmId = feed.children[0]?.['wm-id'] ?? cache.lastWmId;
            const mergedChildren = mergeWebmentions(cache.children, feed.children);

            const webmentionsData: WebmentionsCache = {
              lastWmId: newLastWmId,
              children: mergedChildren,
              'reply-count': countByProperty(mergedChildren, 'in-reply-to'),
              'like-count': countByProperty(mergedChildren, 'like-of'),
              'repost-count': countByProperty(mergedChildren, 'repost-of'),
            };

            // Update file metadata
            file.metadata['webmentions'] = webmentionsData;

            // Write to cache
            if (writeCache) {
              await writeCache(`${cacheDir}/${filePath}webmentions.json`, webmentionsData);
            }

            context.log(
              `webmentions: fetched ${feed.children.length} new mentions for ${filePath}`,
              'debug'
            );
          }
        })()
      );
    }

    await Promise.all(promises);
  };
}

export default webmentions;
