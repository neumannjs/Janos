/**
 * Sitemap plugin
 *
 * Generates sitemap.xml for search engine indexing.
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext, VirtualFile } from '../types.js';

/**
 * URL entry in sitemap
 */
export interface SitemapUrl {
  /** Page URL (absolute) */
  loc: string;
  /** Last modification date */
  lastmod?: Date | string;
  /** Change frequency */
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  /** Priority (0.0 to 1.0) */
  priority?: number;
}

/**
 * Options for sitemap plugin
 */
export interface SitemapOptions {
  /** Output path (default: 'sitemap.xml') */
  destination?: string;
  /** File patterns to include (default: all HTML files) */
  pattern?: string[];
  /** File patterns to exclude */
  exclude?: string[];
  /** Default change frequency */
  changefreq?: SitemapUrl['changefreq'];
  /** Default priority */
  priority?: number;
  /** Hostname override (defaults to site.baseUrl) */
  hostname?: string;
  /** Custom URL generator */
  urlGenerator?: (file: { path: string; metadata: Record<string, unknown> }) => SitemapUrl | null;
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
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date for sitemap (W3C Datetime)
 */
function formatSitemapDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Generate sitemap XML
 */
function generateSitemap(urls: SitemapUrl[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const url of urls) {
    xml += `  <url>
    <loc>${escapeXml(url.loc)}</loc>
`;

    if (url.lastmod) {
      const lastmod = formatSitemapDate(url.lastmod);
      if (lastmod) {
        xml += `    <lastmod>${lastmod}</lastmod>
`;
      }
    }

    if (url.changefreq) {
      xml += `    <changefreq>${url.changefreq}</changefreq>
`;
    }

    if (url.priority !== undefined) {
      xml += `    <priority>${url.priority.toFixed(1)}</priority>
`;
    }

    xml += `  </url>
`;
  }

  xml += `</urlset>`;

  return xml;
}

/**
 * Create the sitemap plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function sitemap(options: SitemapOptions = {}): PipelinePlugin {
  const {
    destination = 'sitemap.xml',
    pattern = ['**/*.html'],
    exclude = [],
    changefreq,
    priority,
    hostname,
    urlGenerator,
  } = options;

  // Default exclusions
  const defaultExclusions = [
    '**/404.html',
    '**/500.html',
    '**/_*/**',  // Files in underscore directories
  ];

  const allExclusions = [...defaultExclusions, ...exclude];

  return async function sitemapPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    const encoder = new TextEncoder();

    // Get base URL
    const baseUrl = (hostname || context.metadata.site?.baseUrl || context.config.baseUrl || '')
      .replace(/\/$/, '');

    if (!baseUrl) {
      context.log('sitemap: no baseUrl configured, skipping', 'warn');
      return;
    }

    const urls: SitemapUrl[] = [];

    for (const [path, file] of files) {
      // Skip non-matching files
      if (!matchPattern(path, pattern)) {
        continue;
      }

      // Skip excluded files
      if (matchPattern(path, allExclusions)) {
        continue;
      }

      // Skip files explicitly marked as not indexable
      if (file.metadata.sitemap === false || file.metadata.noindex === true) {
        continue;
      }

      // Skip layout/source files
      if (path.startsWith('_layouts/') || path.startsWith('_src/')) {
        continue;
      }

      // Generate URL
      let urlEntry: SitemapUrl | null;

      if (urlGenerator) {
        urlEntry = urlGenerator({ path, metadata: file.metadata });
      } else {
        // Default URL generation
        let urlPath = file.metadata.permalink as string | undefined || '/' + path;

        // Clean up path
        if (!urlPath.startsWith('/')) {
          urlPath = '/' + urlPath;
        }

        // Remove index.html from end
        urlPath = urlPath.replace(/\/index\.html$/, '/');

        urlEntry = {
          loc: baseUrl + urlPath,
          lastmod: (file.metadata.modified || file.metadata.date) as Date | string | undefined,
          changefreq: file.metadata.changefreq as SitemapUrl['changefreq'] || changefreq,
          priority: file.metadata.priority as number | undefined ?? priority,
        };
      }

      if (urlEntry) {
        urls.push(urlEntry);
      }
    }

    // Sort URLs for consistent output
    urls.sort((a, b) => a.loc.localeCompare(b.loc));

    // Generate sitemap
    const sitemapContent = generateSitemap(urls);

    const sitemapFile: VirtualFile = {
      path: destination,
      contents: encoder.encode(sitemapContent),
      metadata: { layout: false },
      sourcePath: destination,
    };
    files.set(destination, sitemapFile);

    context.log(`sitemap: generated ${destination} with ${urls.length} URLs`, 'info');
  };
}

export default sitemap;
