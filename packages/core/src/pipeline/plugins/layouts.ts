/**
 * Layouts plugin
 *
 * Renders files through layout templates using the configured template engine.
 * Similar to metalsmith-layouts.
 *
 * Supports Nunjucks {% extends %} and {% include %} by creating a virtual
 * filesystem loader that reads templates from the pipeline's file map.
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext, TemplateEngine } from '../types.js';
import { createNunjucksEngine, createVirtualLoader } from '../../templates/nunjucks.js';

/**
 * Options for layouts plugin
 */
export interface LayoutsOptions {
  /** File patterns to process (default: ['**\/*.html']) */
  pattern?: string[];
  /** Default layout to use if none specified in frontmatter */
  default?: string;
  /** Directory containing layout files */
  directory?: string;
  /** Template engine to use (if not provided, creates Nunjucks with virtual loader) */
  engine?: TemplateEngine;
  /** Engine name to look up from context.templateEngines */
  engineName?: string;
  /** Custom Nunjucks filters */
  filters?: Record<string, (...args: unknown[]) => unknown>;
  /** Custom Nunjucks globals */
  globals?: Record<string, unknown>;
}

/**
 * Simple pattern matching
 */
function matchPattern(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Handle **/*.ext pattern to match both root and nested files
    let regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\{\{GLOBSTAR\}\}\//, '(.*\\/)?'); // **/ matches zero or more directories

    // Handle remaining {{GLOBSTAR}} (for patterns like foo/**)
    regex = regex.replace(/\{\{GLOBSTAR\}\}/g, '.*');

    if (new RegExp(`^${regex}$`).test(path)) {
      return true;
    }
  }
  return false;
}

/**
 * Create the layouts plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function layouts(options: LayoutsOptions = {}): PipelinePlugin {
  const {
    pattern = ['**/*.html'],
    default: defaultLayout,
    directory = '_layouts',
    engine: providedEngine,
    engineName,
    filters = {},
    globals = {},
  } = options;

  return async function layoutsPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');
    const layoutPrefix = directory.endsWith('/') ? directory : directory + '/';

    // Date filter helper
    const dateFilter = (date: unknown, format?: unknown): string => {
      const d = date instanceof Date ? date : new Date(date as string | number);
      if (isNaN(d.getTime())) return String(date);
      if (!format || typeof format !== 'string') return d.toISOString();
      const pad = (n: number) => n.toString().padStart(2, '0');
      return format
        .replace('YYYY', d.getFullYear().toString())
        .replace('MM', pad(d.getMonth() + 1))
        .replace('DD', pad(d.getDate()))
        .replace('HH', pad(d.getHours()))
        .replace('mm', pad(d.getMinutes()))
        .replace('ss', pad(d.getSeconds()));
    };

    // Create a Nunjucks engine with virtual filesystem loader
    // This enables {% extends %} and {% include %} to work
    const virtualLoader = createVirtualLoader(files, directory);
    const engine: TemplateEngine = providedEngine ?? createNunjucksEngine({
      loader: virtualLoader,
      noCache: true,
      filters: {
        date: dateFilter,
        ...filters,
      },
      globals,
    });

    // If a different engine was requested from context, use it
    // (but it won't support extends/include from virtual filesystem)
    let finalEngine = engine;
    if (!providedEngine && engineName) {
      const contextEngine = context.templateEngines.get(engineName);
      if (contextEngine) {
        finalEngine = contextEngine;
        context.log(
          `layouts: using engine '${engineName}' from context (extends/include may not work)`,
          'debug'
        );
      }
    }

    // Build set of available layout paths for validation
    const availableLayouts = new Set<string>();
    for (const [path] of files) {
      if (path.startsWith(layoutPrefix)) {
        const layoutName = path.substring(layoutPrefix.length);
        availableLayouts.add(layoutName);
        // Also add without extension
        const extIndex = layoutName.lastIndexOf('.');
        if (extIndex !== -1) {
          availableLayouts.add(layoutName.substring(0, extIndex));
        }
      }
    }

    // Process files
    let processedCount = 0;

    for (const [path, file] of files) {
      if (!matchPattern(path, pattern)) {
        continue;
      }

      // Skip layout files themselves
      if (path.startsWith(layoutPrefix)) {
        continue;
      }

      // Determine layout
      let layoutName = file.metadata.layout as string | undefined;
      if (!layoutName && defaultLayout) {
        layoutName = defaultLayout;
      }

      if (!layoutName) {
        continue;
      }

      // Resolve layout path - check if it exists
      let resolvedLayoutPath = layoutName;
      if (!availableLayouts.has(layoutName)) {
        // Try with common extensions
        const extensions = ['.njk', '.nunjucks', '.html'];
        for (const ext of extensions) {
          if (availableLayouts.has(layoutName + ext)) {
            resolvedLayoutPath = layoutName + ext;
            break;
          }
        }
      }

      if (!availableLayouts.has(resolvedLayoutPath)) {
        context.log(`layouts: layout '${layoutName}' not found for ${path}`, 'warn');
        continue;
      }

      // Prepare template data
      const content = decoder.decode(file.contents);
      const templateData: Record<string, unknown> = {
        ...context.metadata,
        ...file.metadata,
        contents: content,
        content, // Alias
        page: file.metadata,
        site: context.metadata.site,
      };

      try {
        let rendered: string;

        // Use renderFile so Nunjucks resolves {% extends %} and {% include %}
        if (finalEngine.renderFile) {
          rendered = await finalEngine.renderFile(resolvedLayoutPath, templateData);
        } else {
          // Fallback: load template and use render (won't support extends/include)
          const layoutFile = files.get(layoutPrefix + resolvedLayoutPath);
          if (!layoutFile) {
            context.log(`layouts: layout file not found: ${layoutPrefix + resolvedLayoutPath}`, 'error');
            continue;
          }
          const layoutTemplate = decoder.decode(layoutFile.contents);
          rendered = await finalEngine.render(layoutTemplate, templateData);
        }

        file.contents = encoder.encode(rendered);
        processedCount++;
        context.log(`layouts: rendered ${path} with layout ${resolvedLayoutPath}`, 'debug');
      } catch (error) {
        context.log(
          `layouts: failed to render ${path}: ${error instanceof Error ? error.message : error}`,
          'error'
        );
      }
    }

    context.log(`layouts: rendered ${processedCount} files`, 'info');
  };
}

export default layouts;
