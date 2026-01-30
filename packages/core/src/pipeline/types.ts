/**
 * Content pipeline types and interfaces
 *
 * The pipeline processes source files through a series of plugins
 * to produce the final static site output.
 */

/**
 * Virtual file representing a file in the build pipeline
 */
export interface VirtualFile {
  /** File path relative to source directory */
  path: string;
  /** File contents as binary data */
  contents: Uint8Array;
  /** File metadata and frontmatter */
  metadata: FileMetadata;
  /** Original source path (before transformations) */
  sourcePath?: string;
  /** File encoding (default: utf-8) */
  encoding?: BufferEncoding;
}

/**
 * File metadata including frontmatter and computed properties
 */
export interface FileMetadata {
  /** Document title */
  title?: string;
  /** Document description */
  description?: string;
  /** Publication date */
  date?: Date;
  /** Last modified date */
  modified?: Date;
  /** Draft status */
  draft?: boolean;
  /** Document tags */
  tags?: string[];
  /** Document categories */
  categories?: string[];
  /** Layout template to use */
  layout?: string;
  /** Permalink pattern */
  permalink?: string;
  /** Custom template data */
  [key: string]: unknown;
}

/**
 * Map of file paths to virtual files
 */
export type VirtualFileMap = Map<string, VirtualFile>;

/**
 * Pipeline plugin function signature
 */
export type PipelinePlugin = (
  files: VirtualFileMap,
  context: PipelineContext
) => Promise<void> | void;

/**
 * Pipeline plugin with metadata
 */
export interface Plugin {
  /** Plugin name */
  name: string;
  /** Plugin function */
  process: PipelinePlugin;
  /** Plugin options */
  options?: Record<string, unknown>;
}

/**
 * Site configuration
 */
export interface SiteConfig {
  /** Site title */
  title: string;
  /** Site description */
  description?: string;
  /** Site base URL */
  baseUrl: string;
  /** Site language */
  language?: string;
  /** Author information */
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  /** Source directory */
  sourceDir: string;
  /** Output directory */
  outputDir: string;
  /** Layouts/templates directory */
  layoutsDir?: string;
  /** Static assets directory */
  assetsDir?: string;
  /** Content patterns to process */
  contentPatterns?: string[];
  /** Patterns to ignore */
  ignorePatterns?: string[];
  /** Custom configuration */
  [key: string]: unknown;
}

/**
 * Build context passed to plugins
 */
export interface PipelineContext {
  /** Site configuration */
  config: SiteConfig;
  /** Global metadata available to templates */
  metadata: GlobalMetadata;
  /** Build mode */
  mode: 'development' | 'production';
  /** Log function */
  log: (message: string, level?: 'info' | 'warn' | 'error' | 'debug') => void;
  /** Registered template engines */
  templateEngines: Map<string, TemplateEngine>;
  /** Cache for expensive computations */
  cache: Map<string, unknown>;
}

/**
 * Global metadata available to all templates
 */
export interface GlobalMetadata {
  /** Site configuration subset */
  site: {
    title: string;
    description?: string;
    baseUrl: string;
    language?: string;
    author?: SiteConfig['author'];
  };
  /** Build information */
  build: {
    time: Date;
    mode: 'development' | 'production';
  };
  /** Collections of files (e.g., posts, pages) - plain object for template access */
  collections: Record<string, unknown[]>;
  /** Custom global data */
  [key: string]: unknown;
}

/**
 * Template engine interface
 */
export interface TemplateEngine {
  /** Engine name */
  name: string;
  /** File extensions this engine handles */
  extensions: string[];
  /** Render a template string */
  render(template: string, data: Record<string, unknown>): Promise<string>;
  /** Render a template file */
  renderFile?(path: string, data: Record<string, unknown>): Promise<string>;
  /** Register a helper/filter */
  registerHelper?(name: string, fn: (...args: unknown[]) => unknown): void;
}

/**
 * Build result information
 */
export interface BuildResult {
  /** Number of files processed */
  filesProcessed: number;
  /** Number of files output */
  filesOutput: number;
  /** Build duration in milliseconds */
  duration: number;
  /** Any warnings generated */
  warnings: string[];
  /** Any errors that occurred */
  errors: string[];
}

/**
 * Pipeline events
 */
export interface PipelineEvents {
  /** Called when build starts */
  onStart?: () => void;
  /** Called when a plugin starts processing */
  onPluginStart?: (pluginName: string) => void;
  /** Called when a plugin finishes processing */
  onPluginEnd?: (pluginName: string, duration: number) => void;
  /** Called when a file is processed */
  onFileProcessed?: (path: string) => void;
  /** Called when build completes */
  onComplete?: (result: BuildResult) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Site configuration */
  site: SiteConfig;
  /** Build mode */
  mode?: 'development' | 'production';
  /** Event handlers */
  events?: PipelineEvents;
}

/**
 * Content pipeline interface
 */
export interface IPipeline {
  /**
   * Add a plugin to the pipeline
   * @param plugin - Plugin or plugin function
   * @returns This pipeline for chaining
   */
  use(plugin: Plugin | PipelinePlugin): this;

  /**
   * Register a template engine
   * @param engine - Template engine
   * @returns This pipeline for chaining
   */
  engine(engine: TemplateEngine): this;

  /**
   * Set global metadata
   * @param key - Metadata key
   * @param value - Metadata value
   * @returns This pipeline for chaining
   */
  metadata(key: string, value: unknown): this;

  /**
   * Process all files through the pipeline
   * @param files - Input files
   * @returns Processed files
   */
  process(files: VirtualFileMap): Promise<VirtualFileMap>;

  /**
   * Build the site from source directory
   * @returns Build result
   */
  build(): Promise<BuildResult>;

  /**
   * Get the current context
   */
  getContext(): PipelineContext;
}

/**
 * Factory function type for creating pipeline instances
 */
export type PipelineFactory = (config: PipelineConfig) => IPipeline;
