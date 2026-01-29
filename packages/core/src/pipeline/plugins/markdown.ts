/**
 * Markdown plugin
 *
 * Converts Markdown files to HTML using unified/remark/rehype.
 * Extracts frontmatter and adds it to file metadata.
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext } from '../types.js';
import { processMarkdown, type MarkdownOptions } from '../markdown.js';
import { parseFrontmatter } from '../frontmatter.js';

/**
 * Options for markdown plugin
 */
export interface MarkdownPluginOptions extends MarkdownOptions {
  /** File patterns to process (default: ['**\/*.md', '**\/*.markdown']) */
  pattern?: string[];
  /** Output extension (default: '.html') */
  outputExtension?: string;
  /** Extract frontmatter (default: true) */
  extractFrontmatter?: boolean;
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
 * Change file extension
 */
function changeExtension(path: string, newExt: string): string {
  const lastDot = path.lastIndexOf('.');
  const base = lastDot === -1 ? path : path.substring(0, lastDot);
  return base + newExt;
}

/**
 * Create the markdown plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function markdown(options: MarkdownPluginOptions = {}): PipelinePlugin {
  const {
    pattern = ['**/*.md', '**/*.markdown'],
    outputExtension = '.html',
    extractFrontmatter: shouldExtractFrontmatter = true,
    ...markdownOptions
  } = options;

  return async function markdownPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();
    const toProcess: Array<[string, typeof files extends Map<string, infer V> ? V : never]> = [];

    // Collect files to process
    for (const [path, file] of files) {
      if (matchPattern(path, pattern)) {
        toProcess.push([path, file]);
      }
    }

    // Process each file
    for (const [path, file] of toProcess) {
      let content = decoder.decode(file.contents);

      // Extract frontmatter
      if (shouldExtractFrontmatter) {
        try {
          const { metadata, content: bodyContent, hasFrontmatter } = parseFrontmatter(content, path);

          if (hasFrontmatter) {
            // Merge frontmatter into file metadata
            Object.assign(file.metadata, metadata);
            content = bodyContent;
          }
        } catch (error) {
          context.log(
            `markdown: failed to parse frontmatter in ${path}: ${error instanceof Error ? error.message : error}`,
            'warn'
          );
        }
      }

      // Convert markdown to HTML
      try {
        const { html, messages } = await processMarkdown(content, markdownOptions);

        // Log any processing messages
        for (const message of messages) {
          context.log(`markdown: ${path}: ${message}`, 'debug');
        }

        // Update file contents
        file.contents = encoder.encode(html);

        // Update path to new extension
        const newPath = changeExtension(path, outputExtension);
        if (newPath !== path) {
          files.delete(path);
          files.set(newPath, file);
          file.path = newPath;
        }

        context.log(`markdown: converted ${path} to ${newPath}`, 'debug');
      } catch (error) {
        context.log(
          `markdown: failed to process ${path}: ${error instanceof Error ? error.message : error}`,
          'error'
        );
      }
    }
  };
}

export default markdown;
