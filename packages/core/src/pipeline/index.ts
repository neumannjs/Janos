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
