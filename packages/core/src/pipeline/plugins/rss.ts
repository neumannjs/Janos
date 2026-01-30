/**
 * RSS plugin
 *
 * Generates RSS 2.0 and/or Atom feeds from collections.
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext, VirtualFile } from '../types.js';

/**
 * Options for RSS plugin
 */
export interface RssOptions {
  /** Collection to generate feed from (default: 'posts') */
  collection?: string;
  /** Output path for RSS feed (default: 'rss.xml') */
  destination?: string;
  /** Also generate Atom feed */
  atom?: boolean;
  /** Atom feed output path (default: 'atom.xml') */
  atomDestination?: string;
  /** Maximum number of items in feed (default: 20) */
  limit?: number;
  /** Feed title (defaults to site.title) */
  title?: string;
  /** Feed description (defaults to site.description) */
  description?: string;
  /** Custom item title field (default: 'title') */
  titleField?: string;
  /** Custom item description field (default: 'excerpt' or 'description') */
  descriptionField?: string;
  /** Custom item date field (default: 'date') */
  dateField?: string;
  /** Custom item content field for full content (default: 'contents') */
  contentField?: string;
  /** Include full content in feed (default: false, uses excerpt/description) */
  fullContent?: boolean;
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
 * Format date for RSS (RFC 822)
 */
function formatRssDate(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const day = days[date.getUTCDay()];
  const dayNum = date.getUTCDate().toString().padStart(2, '0');
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');

  return `${day}, ${dayNum} ${month} ${year} ${hours}:${minutes}:${seconds} +0000`;
}

/**
 * Format date for Atom (ISO 8601)
 */
function formatAtomDate(date: Date): string {
  return date.toISOString();
}

/**
 * Get item URL
 */
function getItemUrl(item: Record<string, unknown>, baseUrl: string): string {
  const permalink = item.permalink as string | undefined;
  const path = item.path as string | undefined;

  let url = permalink || path || '';

  // Ensure URL starts with /
  if (url && !url.startsWith('/') && !url.startsWith('http')) {
    url = '/' + url;
  }

  // Make absolute URL
  if (url && !url.startsWith('http')) {
    url = baseUrl.replace(/\/$/, '') + url;
  }

  return url;
}

/**
 * Generate RSS 2.0 feed
 */
function generateRss(
  items: Array<Record<string, unknown>>,
  options: Required<Pick<RssOptions, 'title' | 'description' | 'titleField' | 'descriptionField' | 'dateField' | 'contentField' | 'fullContent'>>,
  siteUrl: string,
  feedUrl: string,
  buildDate: Date
): string {
  const { title, description, titleField, descriptionField, dateField, contentField, fullContent } = options;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${escapeXml(description)}</description>
    <lastBuildDate>${formatRssDate(buildDate)}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
`;

  for (const item of items) {
    const itemTitle = (item[titleField] as string) || 'Untitled';
    const itemDesc = (item[descriptionField] as string) || (item.excerpt as string) || (item.description as string) || '';
    const itemContent = fullContent ? (item[contentField] as string) || '' : '';
    const itemDate = item[dateField] as Date | string | undefined;
    const itemUrl = getItemUrl(item, siteUrl);

    const date = itemDate ? (itemDate instanceof Date ? itemDate : new Date(itemDate)) : buildDate;

    xml += `    <item>
      <title>${escapeXml(itemTitle)}</title>
      <link>${escapeXml(itemUrl)}</link>
      <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>
      <pubDate>${formatRssDate(date)}</pubDate>
      <description>${escapeXml(itemDesc)}</description>
`;

    if (itemContent) {
      xml += `      <content:encoded><![CDATA[${itemContent}]]></content:encoded>
`;
    }

    xml += `    </item>
`;
  }

  xml += `  </channel>
</rss>`;

  return xml;
}

/**
 * Generate Atom feed
 */
function generateAtom(
  items: Array<Record<string, unknown>>,
  options: Required<Pick<RssOptions, 'title' | 'description' | 'titleField' | 'descriptionField' | 'dateField' | 'contentField' | 'fullContent'>>,
  siteUrl: string,
  feedUrl: string,
  buildDate: Date
): string {
  const { title, description, titleField, descriptionField, dateField, contentField, fullContent } = options;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(title)}</title>
  <subtitle>${escapeXml(description)}</subtitle>
  <link href="${escapeXml(feedUrl)}" rel="self" type="application/atom+xml"/>
  <link href="${escapeXml(siteUrl)}" rel="alternate" type="text/html"/>
  <id>${escapeXml(siteUrl)}</id>
  <updated>${formatAtomDate(buildDate)}</updated>
`;

  for (const item of items) {
    const itemTitle = (item[titleField] as string) || 'Untitled';
    const itemDesc = (item[descriptionField] as string) || (item.excerpt as string) || (item.description as string) || '';
    const itemContent = fullContent ? (item[contentField] as string) || itemDesc : itemDesc;
    const itemDate = item[dateField] as Date | string | undefined;
    const itemUrl = getItemUrl(item, siteUrl);

    const date = itemDate ? (itemDate instanceof Date ? itemDate : new Date(itemDate)) : buildDate;

    xml += `  <entry>
    <title>${escapeXml(itemTitle)}</title>
    <link href="${escapeXml(itemUrl)}" rel="alternate" type="text/html"/>
    <id>${escapeXml(itemUrl)}</id>
    <published>${formatAtomDate(date)}</published>
    <updated>${formatAtomDate(date)}</updated>
    <summary type="html">${escapeXml(itemDesc)}</summary>
`;

    if (fullContent && itemContent) {
      xml += `    <content type="html">${escapeXml(itemContent)}</content>
`;
    }

    xml += `  </entry>
`;
  }

  xml += `</feed>`;

  return xml;
}

/**
 * Create the RSS plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function rss(options: RssOptions = {}): PipelinePlugin {
  const {
    collection = 'posts',
    destination = 'rss.xml',
    atom = false,
    atomDestination = 'atom.xml',
    limit = 20,
    titleField = 'title',
    descriptionField = 'excerpt',
    dateField = 'date',
    contentField = 'contents',
    fullContent = false,
  } = options;

  return async function rssPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    const encoder = new TextEncoder();

    // Get collection items
    const collections = context.metadata.collections as Record<string, unknown[]> | undefined;
    const collectionItems = collections?.[collection] || context.metadata[collection];

    if (!collectionItems || !Array.isArray(collectionItems)) {
      context.log(`rss: collection '${collection}' not found or empty`, 'warn');
      return;
    }

    // Limit items
    const items = collectionItems.slice(0, limit) as Array<Record<string, unknown>>;

    // Get site info
    const siteTitle = options.title || context.metadata.site?.title || context.config.title || 'Feed';
    const siteDescription = options.description || context.metadata.site?.description || context.config.description || '';
    const siteUrl = context.metadata.site?.baseUrl || context.config.baseUrl || '';
    const buildDate = context.metadata.build?.time || new Date();

    const feedOptions = {
      title: siteTitle,
      description: siteDescription,
      titleField,
      descriptionField,
      dateField,
      contentField,
      fullContent,
    };

    // Generate RSS feed
    const rssFeedUrl = siteUrl.replace(/\/$/, '') + '/' + destination;
    const rssContent = generateRss(items, feedOptions, siteUrl, rssFeedUrl, buildDate);

    const rssFile: VirtualFile = {
      path: destination,
      contents: encoder.encode(rssContent),
      metadata: { layout: false }, // Don't process with layouts
      sourcePath: destination,
    };
    files.set(destination, rssFile);
    context.log(`rss: generated ${destination} with ${items.length} items`, 'info');

    // Generate Atom feed if requested
    if (atom) {
      const atomFeedUrl = siteUrl.replace(/\/$/, '') + '/' + atomDestination;
      const atomContent = generateAtom(items, feedOptions, siteUrl, atomFeedUrl, buildDate);

      const atomFile: VirtualFile = {
        path: atomDestination,
        contents: encoder.encode(atomContent),
        metadata: { layout: false },
        sourcePath: atomDestination,
      };
      files.set(atomDestination, atomFile);
      context.log(`rss: generated ${atomDestination} with ${items.length} items`, 'info');
    }
  };
}

export default rss;
