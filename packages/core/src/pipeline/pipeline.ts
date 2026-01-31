/**
 * Content pipeline implementation
 */
import type {
  IPipeline,
  PipelineConfig,
  PipelineContext,
  PipelinePlugin,
  Plugin,
  VirtualFile,
  VirtualFileMap,
  TemplateEngine,
  BuildResult,
  GlobalMetadata,
} from './types.js';
import { PluginError, ConfigError } from './errors.js';

/**
 * Built-in coordination rules
 *
 * These rules automatically synchronize data between plugins.
 * For example, after 'permalinks' changes file paths, collection references
 * need to be updated to point to the new paths.
 */
interface CoordinationRule {
  /** Plugin name that triggers this coordination */
  after: string;
  /** Handler to run after the plugin */
  handler: (files: VirtualFileMap, context: PipelineContext) => void;
}

/**
 * Synchronize collection and tag page paths after a plugin changes file paths
 *
 * This updates collection items and tag page items to point to the new file
 * paths after permalinks (or any other path-changing plugin) runs.
 */
function syncCollectionPaths(files: VirtualFileMap, context: PipelineContext): void {
  // Build a map of sourcePath -> current path
  const pathMap = new Map<string, string>();

  for (const [currentPath, file] of files) {
    if (file.sourcePath) {
      pathMap.set(file.sourcePath, currentPath);
      // Also map the .html version of sourcePath (what collections use after markdown)
      const sourceAsHtml = file.sourcePath.replace(/\.md$/, '.html');
      pathMap.set(sourceAsHtml, currentPath);
    }
  }

  let collectionUpdates = 0;
  let tagPageUpdates = 0;

  // Update collection items
  const collections = context.metadata.collections;
  if (collections && typeof collections === 'object') {
    for (const [, items] of Object.entries(collections)) {
      if (!Array.isArray(items)) continue;

      for (const item of items as Array<Record<string, unknown>>) {
        // Skip items with navpath (navigation items use explicit paths)
        if (item.navpath) {
          item.path = item.navpath;
          continue;
        }

        const originalPath = item.path as string | undefined;
        if (originalPath && pathMap.has(originalPath)) {
          const newPath = pathMap.get(originalPath)!;
          item.path = newPath;
          // Set permalink without index.html for cleaner URLs
          item.permalink = '/' + newPath.replace(/\/index\.html$/, '/').replace(/\.html$/, '/');
          collectionUpdates++;
        }
      }
    }

    // Expose collections directly in context metadata for templates
    // (templates use `posts` not `collections.posts`)
    for (const [name, items] of Object.entries(collections)) {
      context.metadata[name] = items;
    }
  }

  // Update tag page items (pagination.files in tag page metadata)
  for (const [, file] of files) {
    const pagination = file.metadata.pagination as {
      files?: Array<Record<string, unknown>>;
    } | undefined;

    if (pagination?.files && Array.isArray(pagination.files)) {
      for (const item of pagination.files) {
        const originalPath = item.path as string | undefined;
        if (originalPath && pathMap.has(originalPath)) {
          const newPath = pathMap.get(originalPath)!;
          item.path = newPath;
          item.permalink = '/' + newPath.replace(/\/index\.html$/, '/').replace(/\.html$/, '/');
          tagPageUpdates++;
        }
      }
    }
  }

  if (collectionUpdates > 0) {
    context.log(`coordination: updated ${collectionUpdates} collection paths`, 'debug');
  }
  if (tagPageUpdates > 0) {
    context.log(`coordination: updated ${tagPageUpdates} tag page item paths`, 'debug');
  }
}

/**
 * Built-in coordination rules for common plugin pairs
 *
 * Note: Plugin names match the inner function names (e.g., 'permalinksPlugin'),
 * not the factory function names (e.g., 'permalinks').
 */
const BUILTIN_COORDINATION: CoordinationRule[] = [
  { after: 'permalinksPlugin', handler: syncCollectionPaths },
];

/**
 * Default pipeline implementation
 */
export class Pipeline implements IPipeline {
  private plugins: Plugin[] = [];
  private engines: Map<string, TemplateEngine> = new Map();
  private globalMetadata: Map<string, unknown> = new Map();
  private readonly config: PipelineConfig;
  private context: PipelineContext;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.validateConfig(config);
    this.context = this.createContext();
  }

  private validateConfig(config: PipelineConfig): void {
    if (!config.site.title) {
      throw new ConfigError('Site title is required', 'site.title');
    }
    if (!config.site.baseUrl) {
      throw new ConfigError('Site base URL is required', 'site.baseUrl');
    }
    if (!config.site.sourceDir) {
      throw new ConfigError('Source directory is required', 'site.sourceDir');
    }
    if (!config.site.outputDir) {
      throw new ConfigError('Output directory is required', 'site.outputDir');
    }
  }

  private createContext(): PipelineContext {
    const globalMeta: GlobalMetadata = {
      site: {
        title: this.config.site.title,
        description: this.config.site.description,
        baseUrl: this.config.site.baseUrl,
        language: this.config.site.language,
        author: this.config.site.author,
      },
      build: {
        time: new Date(),
        mode: this.config.mode ?? 'development',
      },
      collections: {},
    };

    // Add any custom global metadata
    for (const [key, value] of this.globalMetadata) {
      globalMeta[key] = value;
    }

    return {
      config: this.config.site,
      metadata: globalMeta,
      mode: this.config.mode ?? 'development',
      log: this.createLogger(),
      templateEngines: this.engines,
      cache: new Map(),
    };
  }

  private createLogger(): PipelineContext['log'] {
    return (message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
      const prefix = `[${level.toUpperCase()}]`;

      switch (level) {
        case 'error':
          console.error(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          break;
        case 'debug':
          if (this.config.mode === 'development') {
            console.debug(prefix, message);
          }
          break;
        default:
          console.log(prefix, message);
      }
    };
  }

  use(plugin: Plugin | PipelinePlugin): this {
    if (typeof plugin === 'function') {
      this.plugins.push({
        name: plugin.name || `plugin-${this.plugins.length}`,
        process: plugin,
      });
    } else {
      this.plugins.push(plugin);
    }
    return this;
  }

  engine(engine: TemplateEngine): this {
    for (const ext of engine.extensions) {
      this.engines.set(ext, engine);
    }
    return this;
  }

  metadata(key: string, value: unknown): this {
    this.globalMetadata.set(key, value);
    // Update context
    this.context.metadata[key] = value;
    return this;
  }

  async process(files: VirtualFileMap): Promise<VirtualFileMap> {
    // Update build time
    this.context.metadata.build.time = new Date();

    // Process through each plugin
    for (const plugin of this.plugins) {
      const startTime = Date.now();
      this.config.events?.onPluginStart?.(plugin.name);

      try {
        await plugin.process(files, this.context);
      } catch (error) {
        const pluginError = new PluginError(
          plugin.name,
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined
        );
        this.config.events?.onError?.(pluginError);
        throw pluginError;
      }

      // Run any built-in coordination handlers for this plugin
      for (const rule of BUILTIN_COORDINATION) {
        if (rule.after === plugin.name) {
          try {
            rule.handler(files, this.context);
          } catch (error) {
            this.context.log(
              `coordination after '${plugin.name}' failed: ${error instanceof Error ? error.message : error}`,
              'warn'
            );
          }
        }
      }

      const duration = Date.now() - startTime;
      this.config.events?.onPluginEnd?.(plugin.name, duration);
    }

    return files;
  }

  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    this.config.events?.onStart?.();

    // This is a placeholder - actual implementation would:
    // 1. Read source files
    // 2. Convert to VirtualFileMap
    // 3. Process through pipeline
    // 4. Write output files

    const files: VirtualFileMap = new Map();
    let filesOutput = 0;

    try {
      await this.process(files);
      filesOutput = files.size;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    const duration = Date.now() - startTime;

    const result: BuildResult = {
      filesProcessed: files.size,
      filesOutput,
      duration,
      warnings,
      errors,
    };

    this.config.events?.onComplete?.(result);

    return result;
  }

  getContext(): PipelineContext {
    return this.context;
  }
}

/**
 * Create a new pipeline instance
 * @param config - Pipeline configuration
 * @returns Pipeline instance
 */
export function createPipeline(config: PipelineConfig): IPipeline {
  return new Pipeline(config);
}

/**
 * Create a virtual file
 * @param path - File path
 * @param contents - File contents (string or binary)
 * @param metadata - File metadata
 * @returns Virtual file
 */
export function createVirtualFile(
  path: string,
  contents: string | Uint8Array,
  metadata: VirtualFile['metadata'] = {}
): VirtualFile {
  const encoder = new TextEncoder();
  return {
    path,
    contents: typeof contents === 'string' ? encoder.encode(contents) : contents,
    metadata,
    sourcePath: path,
  };
}

/**
 * Get file contents as string
 * @param file - Virtual file
 * @returns Contents as string
 */
export function getFileContents(file: VirtualFile): string {
  const decoder = new TextDecoder(file.encoding ?? 'utf-8');
  return decoder.decode(file.contents);
}

/**
 * Set file contents from string
 * @param file - Virtual file
 * @param contents - New contents
 */
export function setFileContents(file: VirtualFile, contents: string): void {
  const encoder = new TextEncoder();
  file.contents = encoder.encode(contents);
}
