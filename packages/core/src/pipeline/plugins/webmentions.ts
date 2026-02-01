/**
 * Webmentions plugin
 *
 * Fetches webmentions from a webmention API and adds them to file metadata.
 * Supports caching to avoid repeated API calls.
 *
 * Default endpoint is webmention.io but can be configured to use
 * alternative services like go-jamming or webmention.app.
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
  /** Base URL of the site (optional - derived from site.baseUrl if not provided) */
  baseUrl?: string;
  /** Domain registered with webmention.io (optional, derived from baseUrl) */
  domain?: string;
  /**
   * Webmention API endpoint URL (default: 'https://webmention.io/api')
   * Can be set to use alternative webmention services like:
   * - Self-hosted go-jamming instance
   * - webmention.app
   * - Custom webmention receiver
   */
  endpoint?: string;
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

const DEFAULT_ENDPOINT = 'https://webmention.io/api';

/**
 * Fetch webmentions from API
 * Supports webmention.io JF2 format and compatible APIs
 */
async function fetchWebmentions(
  url: string,
  lastWmId: number | null,
  perPage: number,
  fetchFn: typeof fetch,
  endpoint: string
): Promise<{ children: Webmention[] } | null> {
  let requestUrl = `${endpoint}/mentions.jf2?target=${encodeURIComponent(url)}&per-page=${perPage}`;
  if (lastWmId) {
    requestUrl += `&since_id=${lastWmId}`;
  }

  try {
    const response = await fetchFn(requestUrl);
    if (response.ok) {
      const data = await response.json() as { children: Webmention[] };
      return data;
    }
    // Log non-OK responses at debug level for troubleshooting
    console.debug(`Webmentions API returned status ${response.status} for ${url}`);
  } catch (error) {
    // Graceful fallback - webmentions are optional enhancement
    // Don't fail the build if the service is unavailable
    console.warn('Failed to fetch webmentions:', error instanceof Error ? error.message : error);
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
 * Get the URL path for a file (without leading slash)
 */
function getFilePath(file: VirtualFile): string {
  // Use permalink if available, otherwise use path
  let result = file.metadata.permalink as string | undefined;

  if (!result) {
    // Convert path to URL path (remove extension, add trailing slash)
    result = file.path;
    const extIndex = result.lastIndexOf('.');
    if (extIndex !== -1) {
      result = result.substring(0, extIndex);
    }
    if (result !== '' && !result.endsWith('/')) {
      result += '/';
    }
  }

  // Remove leading slash to avoid double slashes when combined with baseUrl
  if (result.startsWith('/')) {
    result = result.substring(1);
  }

  return result;
}

/**
 * Create the webmentions plugin
 * @param options - Plugin options (optional - baseUrl derived from site config if not provided)
 * @returns Pipeline plugin
 */
export function webmentions(options: WebmentionsOptions = {}): PipelinePlugin {
  const {
    baseUrl: optionsBaseUrl,
    endpoint = DEFAULT_ENDPOINT,
    cacheDir = 'cache',
    perPage = 10000,
    fetch: fetchFn = globalThis.fetch,
    readCache,
    writeCache,
  } = options;

  return async function webmentionsPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    // Get baseUrl from options or site config
    const baseUrl = optionsBaseUrl ?? context.config.baseUrl;
    if (!baseUrl) {
      context.log('webmentions: no baseUrl configured, skipping', 'warn');
      return;
    }

    // Ensure baseUrl ends with /
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';

    const promises: Promise<void>[] = [];
    let fileCount = 0;
    let mentionCount = 0;

    for (const [, file] of files) {
      if (!shouldFetchWebmentions(file)) {
        continue;
      }
      fileCount++;

      const urlPath = getFilePath(file);
      const fullUrl = normalizedBaseUrl + urlPath;

      promises.push(
        (async () => {
          // Try to read from cache
          let cache: WebmentionsCache = {
            lastWmId: null,
            children: [],
          };

          if (readCache) {
            const cached = await readCache(`${cacheDir}/${urlPath}webmentions.json`);
            if (cached) {
              cache = cached;
            }
          }

          // Set initial webmentions from cache
          file.metadata['webmentions'] = cache;

          // Fetch new webmentions
          const feed = await fetchWebmentions(fullUrl, cache.lastWmId, perPage, fetchFn, endpoint);

          if (feed && feed.children.length > 0) {
            mentionCount += feed.children.length;
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
              await writeCache(`${cacheDir}/${urlPath}webmentions.json`, webmentionsData);
            }
          }
        })()
      );
    }

    await Promise.all(promises);
    context.log(`webmentions: checked ${fileCount} files, fetched ${mentionCount} mentions`, 'info');
  };
}

export default webmentions;
