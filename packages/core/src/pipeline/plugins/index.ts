/**
 * Built-in pipeline plugins
 *
 * These plugins provide common static site generation functionality.
 */

export { collections, type CollectionsOptions, type CollectionConfig, type CollectionItem } from './collections.js';
export { cssUrls, type CssUrlsOptions } from './css-urls.js';
export { excerpts, type ExcerptsOptions } from './excerpts.js';
export { pagination, type PaginationOptions, type PaginationConfig, type PaginationData, type PageInfo } from './pagination.js';
export { inlineSource, type InlineSourceOptions } from './inline-source.js';
export { layouts, type LayoutsOptions } from './layouts.js';
export { markdown, type MarkdownPluginOptions } from './markdown.js';
export { permalinks, type PermalinksOptions } from './permalinks.js';
export { webmentions, type WebmentionsOptions, type Webmention, type WebmentionsCache } from './webmentions.js';
export { responsiveImages, type ResponsiveImagesOptions } from './responsive-images.js';
