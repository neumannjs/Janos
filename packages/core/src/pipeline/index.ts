/**
 * Pipeline module
 *
 * Provides content processing pipeline for static site generation.
 */

// Types
export type {
  IPipeline,
  PipelineConfig,
  PipelineContext,
  PipelinePlugin,
  PipelineFactory,
  PipelineEvents,
  Plugin,
  VirtualFile,
  VirtualFileMap,
  FileMetadata,
  TemplateEngine,
  SiteConfig,
  GlobalMetadata,
  BuildResult,
} from './types.js';

// Errors
export {
  PipelineError,
  PluginError,
  FileProcessingError,
  FrontmatterError,
  TemplateError,
  LayoutNotFoundError,
  ConfigError,
  EngineNotFoundError,
  isPipelineError,
  isPipelineErrorCode,
} from './errors.js';

// Pipeline implementation
export {
  Pipeline,
  createPipeline,
  createVirtualFile,
  getFileContents,
  setFileContents,
} from './pipeline.js';

// Frontmatter utilities
export {
  parseFrontmatter,
  stringifyFrontmatter,
  extractFrontmatter,
  applyFrontmatter,
  type FrontmatterResult,
} from './frontmatter.js';

// Markdown processing
export {
  createMarkdownProcessor,
  processMarkdown,
  processMarkdownSync,
  defaultMarkdownProcessor,
  type MarkdownOptions,
  type MarkdownResult,
} from './markdown.js';

// Built-in plugins
export {
  assets,
  collections,
  cssUrls,
  excerpts,
  inlineSource,
  layouts,
  markdown,
  pagination,
  permalinks,
  webmentions,
  responsiveImages,
  type AssetsOptions,
  type AssetSource,
  type CollectionsOptions,
  type CollectionConfig,
  type CollectionItem,
  type CssUrlsOptions,
  type ExcerptsOptions,
  type InlineSourceOptions,
  type LayoutsOptions,
  type MarkdownPluginOptions,
  type PaginationOptions,
  type PaginationConfig,
  type PaginationData,
  type PageInfo,
  type PermalinksOptions,
  type Linkset,
  type LinksetMatch,
  type WebmentionsOptions,
  type Webmention,
  type WebmentionsCache,
  type ResponsiveImagesOptions,
} from './plugins/index.js';

// JSON Configuration
export {
  loadConfig,
  parseConfig,
  validateConfig,
  createPipelineFromConfig,
  registerPlugin,
  unregisterPlugin,
  listPlugins,
  hasPlugin,
  type JsonConfig,
  type JsonSiteConfig,
  type JsonPluginConfig,
} from './config.js';
