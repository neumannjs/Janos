/**
 * Markdown processing using Unified.js (remark/rehype)
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import type { Processor } from 'unified';

/**
 * Options for markdown processing
 */
export interface MarkdownOptions {
  /** Enable GitHub Flavored Markdown (tables, strikethrough, etc.) */
  gfm?: boolean;
  /** Allow raw HTML in markdown */
  allowHtml?: boolean;
  /** Custom remark plugins */
  remarkPlugins?: Array<unknown>;
  /** Custom rehype plugins */
  rehypePlugins?: Array<unknown>;
}

/**
 * Result of markdown processing
 */
export interface MarkdownResult {
  /** Rendered HTML content */
  html: string;
  /** Any messages/warnings from processing */
  messages: string[];
}

/**
 * Create a markdown processor with the given options
 * @param options - Processing options
 * @returns Configured unified processor
 */
export function createMarkdownProcessor(options: MarkdownOptions = {}): Processor {
  const {
    gfm = true,
    allowHtml = true,
    remarkPlugins = [],
    rehypePlugins = [],
  } = options;

  // Build the processor pipeline
  // Using 'as unknown as Processor' to handle the complex type transformations from unified
  let processor: Processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml']) as unknown as Processor;

  // Add GFM support if enabled
  if (gfm) {
    processor = processor.use(remarkGfm) as unknown as Processor;
  }

  // Add custom remark plugins
  for (const plugin of remarkPlugins) {
    processor = processor.use(plugin as Parameters<typeof processor.use>[0]) as unknown as Processor;
  }

  // Convert to HTML
  processor = processor.use(remarkRehype, { allowDangerousHtml: allowHtml }) as unknown as Processor;

  // Allow raw HTML passthrough
  if (allowHtml) {
    processor = processor.use(rehypeRaw) as unknown as Processor;
  }

  // Add custom rehype plugins
  for (const plugin of rehypePlugins) {
    processor = processor.use(plugin as Parameters<typeof processor.use>[0]) as unknown as Processor;
  }

  // Stringify to HTML
  processor = processor.use(rehypeStringify) as unknown as Processor;

  return processor;
}

/**
 * Process markdown content to HTML
 * @param markdown - Markdown content
 * @param options - Processing options
 * @returns Processed result with HTML and messages
 */
export async function processMarkdown(
  markdown: string,
  options: MarkdownOptions = {}
): Promise<MarkdownResult> {
  const processor = createMarkdownProcessor(options);
  const result = await processor.process(markdown);

  return {
    html: String(result),
    messages: result.messages.map((m) => String(m)),
  };
}

/**
 * Synchronously process markdown content to HTML
 * @param markdown - Markdown content
 * @param options - Processing options
 * @returns Processed result with HTML and messages
 */
export function processMarkdownSync(
  markdown: string,
  options: MarkdownOptions = {}
): MarkdownResult {
  const processor = createMarkdownProcessor(options);
  const result = processor.processSync(markdown);

  return {
    html: String(result),
    messages: result.messages.map((m) => String(m)),
  };
}

/**
 * Default markdown processor instance
 */
export const defaultMarkdownProcessor = createMarkdownProcessor();
