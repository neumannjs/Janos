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
  cssUrls,
  inlineSource,
  layouts,
  markdown,
  permalinks,
  webmentions,
  type CssUrlsOptions,
  type InlineSourceOptions,
  type LayoutsOptions,
  type MarkdownPluginOptions,
  type PermalinksOptions,
  type WebmentionsOptions,
  type Webmention,
  type WebmentionsCache,
} from './plugins/index.js';
