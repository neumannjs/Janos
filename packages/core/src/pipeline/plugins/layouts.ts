/**
 * Layouts plugin
 *
 * Renders files through layout templates using the configured template engine.
 * Similar to metalsmith-layouts.
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext, TemplateEngine } from '../types.js';

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
  /** Template engine to use */
  engine?: TemplateEngine;
  /** Engine name to look up from context.templateEngines */
  engineName?: string;
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
  } = options;

  return async function layoutsPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    // Determine which engine to use
    let engine: TemplateEngine | undefined = providedEngine;

    if (!engine && engineName) {
      engine = context.templateEngines.get(engineName);
    }

    if (!engine) {
      // Try to find any registered engine
      const engines = Array.from(context.templateEngines.values());
      engine = engines[0];
    }

    if (!engine) {
      context.log('layouts: no template engine available, skipping', 'warn');
      return;
    }

    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();

    // Build a map of layout templates
    const layoutTemplates = new Map<string, string>();
    const layoutPrefix = directory.endsWith('/') ? directory : directory + '/';

    for (const [path, file] of files) {
      if (path.startsWith(layoutPrefix)) {
        const layoutName = path.substring(layoutPrefix.length);
        layoutTemplates.set(layoutName, decoder.decode(file.contents));

        // Also map without extension
        const extIndex = layoutName.lastIndexOf('.');
        if (extIndex !== -1) {
          layoutTemplates.set(layoutName.substring(0, extIndex), decoder.decode(file.contents));
        }
      }
    }

    // Process files
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

      // Find layout template
      let layoutTemplate = layoutTemplates.get(layoutName);

      // Try with common extensions
      if (!layoutTemplate) {
        for (const ext of engine.extensions) {
          layoutTemplate = layoutTemplates.get(layoutName + ext);
          if (layoutTemplate) break;
        }
      }

      if (!layoutTemplate) {
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
        const rendered = await engine.render(layoutTemplate, templateData);
        file.contents = encoder.encode(rendered);
        context.log(`layouts: rendered ${path} with layout ${layoutName}`, 'debug');
      } catch (error) {
        context.log(
          `layouts: failed to render ${path}: ${error instanceof Error ? error.message : error}`,
          'error'
        );
      }
    }
  };
}

export default layouts;
