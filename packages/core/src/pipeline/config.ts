/**
 * JSON Configuration Loader
 *
 * Parses janos.config.json and creates a configured pipeline.
 * This is the canonical configuration format that all interfaces compile to.
 */
import { Pipeline } from './pipeline.js';
import type { IPipeline, PipelineConfig } from './types.js';

// Import all built-in plugins
import { assets, type AssetsOptions } from './plugins/assets.js';
import { collections, type CollectionsOptions } from './plugins/collections.js';
import { cssUrls, type CssUrlsOptions } from './plugins/css-urls.js';
import { excerpts, type ExcerptsOptions } from './plugins/excerpts.js';
import { inlineSource, type InlineSourceOptions } from './plugins/inline-source.js';
import { layouts, type LayoutsOptions } from './plugins/layouts.js';
import { markdown, type MarkdownPluginOptions } from './plugins/markdown.js';
import { pagination, type PaginationOptions } from './plugins/pagination.js';
import { permalinks, type PermalinksOptions } from './plugins/permalinks.js';
import { responsiveImages, type ResponsiveImagesOptions } from './plugins/responsive-images.js';
import { webmentions, type WebmentionsOptions } from './plugins/webmentions.js';

/**
 * JSON config site section
 */
export interface JsonSiteConfig {
  title: string;
  baseUrl: string;
  description?: string;
  language?: string;
  author?: string | { name: string; email?: string; url?: string };
  sourceDir?: string;
  layoutsDir?: string;
  outputDir?: string;
}

/**
 * Plugin configuration in JSON
 * Can be a string (plugin name with defaults) or object (plugin name -> options)
 */
export type JsonPluginConfig = string | Record<string, unknown>;

/**
 * Complete JSON configuration structure
 */
export interface JsonConfig {
  /** JSON Schema reference for editor support */
  $schema?: string;
  /** Site configuration */
  site: JsonSiteConfig;
  /** Custom metadata available to templates */
  metadata?: Record<string, unknown>;
  /** Pipeline plugins in order */
  pipeline: JsonPluginConfig[];
  /** Build mode */
  mode?: 'development' | 'production';
}

/**
 * Plugin factory function type
 */
type PluginFactory<T = unknown> = (options?: T) => ReturnType<typeof markdown>;

/**
 * Registry of built-in plugins
 */
const PLUGIN_REGISTRY: Record<string, PluginFactory> = {
  assets: assets as PluginFactory<AssetsOptions>,
  collections: collections as PluginFactory<CollectionsOptions>,
  'css-urls': cssUrls as PluginFactory<CssUrlsOptions>,
  cssUrls: cssUrls as PluginFactory<CssUrlsOptions>,
  excerpts: excerpts as PluginFactory<ExcerptsOptions>,
  'inline-source': inlineSource as PluginFactory<InlineSourceOptions>,
  inlineSource: inlineSource as PluginFactory<InlineSourceOptions>,
  layouts: layouts as PluginFactory<LayoutsOptions>,
  markdown: markdown as PluginFactory<MarkdownPluginOptions>,
  pagination: pagination as PluginFactory<PaginationOptions>,
  permalinks: permalinks as PluginFactory<PermalinksOptions>,
  'responsive-images': responsiveImages as PluginFactory<ResponsiveImagesOptions>,
  responsiveImages: responsiveImages as PluginFactory<ResponsiveImagesOptions>,
  webmentions: webmentions as PluginFactory<WebmentionsOptions>,
};

/**
 * Custom plugin registry for user-defined plugins
 */
const customPlugins: Map<string, PluginFactory> = new Map();

/**
 * Register a custom plugin
 * @param name - Plugin name
 * @param factory - Plugin factory function
 */
export function registerPlugin(name: string, factory: PluginFactory): void {
  if (PLUGIN_REGISTRY[name]) {
    throw new Error(`Cannot override built-in plugin: ${name}`);
  }
  customPlugins.set(name, factory);
}

/**
 * Unregister a custom plugin
 * @param name - Plugin name
 */
export function unregisterPlugin(name: string): void {
  customPlugins.delete(name);
}

/**
 * Get a plugin factory by name
 * @param name - Plugin name
 * @returns Plugin factory or undefined
 */
function getPluginFactory(name: string): PluginFactory | undefined {
  return PLUGIN_REGISTRY[name] ?? customPlugins.get(name);
}

/**
 * Parse a plugin configuration entry
 * @param config - Plugin config (string or object)
 * @returns Tuple of [pluginName, options]
 */
function parsePluginConfig(config: JsonPluginConfig): [string, Record<string, unknown>] {
  if (typeof config === 'string') {
    return [config, {}];
  }

  // Object format: { "pluginName": { options } }
  const keys = Object.keys(config);
  if (keys.length !== 1) {
    throw new Error(
      `Invalid plugin config: expected single key (plugin name), got ${keys.length} keys: ${keys.join(', ')}`
    );
  }

  const pluginName = keys[0];
  const options = config[pluginName];

  if (typeof options !== 'object' || options === null) {
    throw new Error(`Invalid plugin options for "${pluginName}": expected object`);
  }

  return [pluginName, options as Record<string, unknown>];
}

/**
 * Validate JSON configuration
 * @param config - Configuration to validate
 * @throws Error if config is invalid
 */
export function validateConfig(config: unknown): asserts config is JsonConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be an object');
  }

  const c = config as Record<string, unknown>;

  // Validate site section
  if (!c.site || typeof c.site !== 'object') {
    throw new Error('Config must have a "site" section');
  }

  const site = c.site as Record<string, unknown>;
  if (!site.title || typeof site.title !== 'string') {
    throw new Error('site.title is required and must be a string');
  }
  if (!site.baseUrl || typeof site.baseUrl !== 'string') {
    throw new Error('site.baseUrl is required and must be a string');
  }

  // Validate pipeline section
  if (!c.pipeline || !Array.isArray(c.pipeline)) {
    throw new Error('Config must have a "pipeline" array');
  }

  for (let i = 0; i < c.pipeline.length; i++) {
    const plugin = c.pipeline[i];
    if (typeof plugin !== 'string' && typeof plugin !== 'object') {
      throw new Error(`pipeline[${i}] must be a string or object`);
    }
  }
}

/**
 * Parse JSON config string
 * @param json - JSON string
 * @returns Parsed configuration
 */
export function parseConfig(json: string): JsonConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : e}`);
  }

  validateConfig(parsed);
  return parsed;
}

/**
 * Create a pipeline from JSON configuration
 * @param config - JSON configuration object
 * @returns Configured pipeline
 */
export function createPipelineFromConfig(config: JsonConfig): IPipeline {
  // Build PipelineConfig from JsonConfig
  const pipelineConfig: PipelineConfig = {
    site: {
      title: config.site.title,
      baseUrl: config.site.baseUrl,
      description: config.site.description,
      language: config.site.language,
      author: typeof config.site.author === 'string'
        ? { name: config.site.author }
        : config.site.author,
      sourceDir: config.site.sourceDir ?? '_src',
      outputDir: config.site.outputDir ?? '/',
      layoutsDir: config.site.layoutsDir ?? '_layouts',
    },
    mode: config.mode ?? 'development',
  };

  const pipeline = new Pipeline(pipelineConfig);

  // Add custom metadata
  if (config.metadata) {
    for (const [key, value] of Object.entries(config.metadata)) {
      pipeline.metadata(key, value);
    }
  }

  // Add plugins
  for (const pluginConfig of config.pipeline) {
    const [pluginName, options] = parsePluginConfig(pluginConfig);

    const factory = getPluginFactory(pluginName);
    if (!factory) {
      throw new Error(`Unknown plugin: "${pluginName}". Available plugins: ${listPlugins().join(', ')}`);
    }

    const plugin = factory(options);
    pipeline.use(plugin);
  }

  return pipeline;
}

/**
 * Load and create pipeline from JSON string
 * @param json - JSON configuration string
 * @returns Configured pipeline
 */
export function loadConfig(json: string): IPipeline {
  const config = parseConfig(json);
  return createPipelineFromConfig(config);
}

/**
 * List all available plugin names
 * @returns Array of plugin names
 */
export function listPlugins(): string[] {
  const builtIn = Object.keys(PLUGIN_REGISTRY);
  const custom = Array.from(customPlugins.keys());
  return [...new Set([...builtIn, ...custom])].sort();
}

/**
 * Check if a plugin exists
 * @param name - Plugin name
 * @returns True if plugin exists
 */
export function hasPlugin(name: string): boolean {
  return !!getPluginFactory(name);
}
