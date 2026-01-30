/**
 * Built-in pipeline plugins
 *
 * These plugins provide common static site generation functionality.
 */

export { assets, type AssetsOptions, type AssetSource } from './assets.js';
export { collections, type CollectionsOptions, type CollectionConfig, type CollectionItem } from './collections.js';
export { cssUrls, type CssUrlsOptions } from './css-urls.js';
export { excerpts, type ExcerptsOptions } from './excerpts.js';
export { inlineSource, type InlineSourceOptions } from './inline-source.js';
export { layouts, type LayoutsOptions } from './layouts.js';
export { markdown, type MarkdownPluginOptions } from './markdown.js';
export { pagination, type PaginationOptions, type PaginationConfig, type PaginationData, type PageInfo } from './pagination.js';
export { permalinks, type PermalinksOptions, type Linkset, type LinksetMatch } from './permalinks.js';
export { publish, type PublishOptions } from './publish.js';
export { responsiveImages, type ResponsiveImagesOptions } from './responsive-images.js';
export { rss, type RssOptions } from './rss.js';
export { sitemap, type SitemapOptions, type SitemapUrl } from './sitemap.js';
export { tagPages, type TagPagesOptions } from './tag-pages.js';
export { tags, type TagsOptions, type Tag } from './tags.js';
export { webmentions, type WebmentionsOptions, type Webmention, type WebmentionsCache } from './webmentions.js';
