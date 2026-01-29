/**
 * Responsive Images plugin
 *
 * Transforms markdown image elements into responsive <picture> elements.
 * Processes images through the image processor to generate multiple
 * formats (AVIF, WebP, JPG) and sizes for optimal delivery.
 *
 * Ported from: _legacy/plugins/metalsmith-responsive-images.js
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext, VirtualFile } from '../types.js';
import type {
  ImageProcessorOptions,
  ResponsiveImageOptions,
} from '../../images/types.js';
import { createImageProcessor, generatePictureHtml } from '../../images/index.js';

/**
 * Options for responsive images plugin
 */
export interface ResponsiveImagesOptions extends ImageProcessorOptions {
  /** File patterns to process (default: ['**\/*.md', '**\/*.html']) */
  pattern?: string[];

  /** Sizes attribute for responsive behavior (CSS media query based) */
  sizesAttr?: string;

  /** Include figure caption from image title */
  caption?: boolean;

  /** CSS class to apply to picture elements */
  className?: string;

  /** Base path for image URLs (default: '/') */
  basePath?: string;

  /** Whether to process images (if false, only transforms syntax) */
  processImages?: boolean;

  /** Callback to store processed image files */
  storeImage?: (path: string, data: Uint8Array) => Promise<void> | void;
}

/**
 * Default options
 */
const DEFAULT_PLUGIN_OPTIONS: Required<Omit<ResponsiveImagesOptions, keyof ImageProcessorOptions | 'storeImage'>> = {
  pattern: ['**/*.md', '**/*.html'],
  sizesAttr: '',
  caption: false,
  className: '',
  basePath: '/',
  processImages: true,
};

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
 * Markdown image regex: ![alt](url "title")
 * Captures: alt, url, title (optional)
 */
const MARKDOWN_IMAGE_REGEX = /!\[(?<alt>[^\]]*)\]\((?<url>[^\s)]+)(?:\s+"(?<title>[^"]*)")?\)/g;

/**
 * Async replace helper
 */
async function replaceAsync(
  str: string,
  regex: RegExp,
  asyncFn: (match: string, ...args: unknown[]) => Promise<string>
): Promise<string> {
  const matches: Array<{ match: string; index: number; result: Promise<string> }> = [];

  // Reset regex state
  regex.lastIndex = 0;

  let match;
  while ((match = regex.exec(str)) !== null) {
    matches.push({
      match: match[0],
      index: match.index,
      result: asyncFn(match[0], ...match.slice(1), match.index, str, match.groups),
    });
  }

  // Wait for all replacements
  const results = await Promise.all(matches.map((m) => m.result));

  // Apply replacements in reverse order to preserve indices
  let result = str;
  for (let i = matches.length - 1; i >= 0; i--) {
    const entry = matches[i]!;
    const replacement = results[i] ?? '';
    result = result.slice(0, entry.index) + replacement + result.slice(entry.index + entry.match.length);
  }

  return result;
}

/**
 * Check if a URL is external
 */
function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
}

/**
 * Get directory from path
 */
function getDirectory(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? '' : path.substring(0, lastSlash);
}

/**
 * Normalize path (resolve relative paths)
 */
function normalizePath(basePath: string, relativePath: string): string {
  if (relativePath.startsWith('/')) {
    return relativePath.substring(1);
  }

  const baseParts = basePath.split('/').filter(Boolean);
  const relativeParts = relativePath.split('/');

  for (const part of relativeParts) {
    if (part === '..') {
      baseParts.pop();
    } else if (part !== '.') {
      baseParts.push(part);
    }
  }

  return baseParts.join('/');
}

/**
 * Create the responsive images plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function responsiveImages(options: ResponsiveImagesOptions = {}): PipelinePlugin {
  const {
    pattern = DEFAULT_PLUGIN_OPTIONS.pattern,
    sizesAttr = DEFAULT_PLUGIN_OPTIONS.sizesAttr,
    caption = DEFAULT_PLUGIN_OPTIONS.caption,
    className = DEFAULT_PLUGIN_OPTIONS.className,
    basePath = DEFAULT_PLUGIN_OPTIONS.basePath,
    processImages = DEFAULT_PLUGIN_OPTIONS.processImages,
    storeImage,
    // Image processor options
    formats,
    sizes,
    quality,
    maxDimension,
    keepOriginal,
    filenamePattern,
  } = options;

  const processorOptions: ImageProcessorOptions = {
    formats,
    sizes,
    quality,
    maxDimension,
    keepOriginal,
    filenamePattern,
  };

  // Remove undefined values
  Object.keys(processorOptions).forEach((key) => {
    if (processorOptions[key as keyof ImageProcessorOptions] === undefined) {
      delete processorOptions[key as keyof ImageProcessorOptions];
    }
  });

  const processor = createImageProcessor();

  return async function responsiveImagesPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();

    // Cache for processed images to avoid reprocessing duplicates
    const processedCache = new Map<string, string>();

    // Collect files to process
    const filesToProcess: Array<[string, VirtualFile]> = [];
    for (const [path, file] of files) {
      if (matchPattern(path, pattern)) {
        filesToProcess.push([path, file]);
      }
    }

    // Process each file
    for (const [filePath, file] of filesToProcess) {
      let content = decoder.decode(file.contents);
      const fileDir = getDirectory(filePath);

      // Replace markdown images with responsive picture elements
      content = await replaceAsync(
        content,
        MARKDOWN_IMAGE_REGEX,
        async (match, alt, url, title, _offset, _str, groups) => {
          // Use named groups if available
          const imgAlt = (groups as { alt?: string })?.alt ?? (alt as string) ?? '';
          const imgUrl = (groups as { url?: string })?.url ?? (url as string) ?? '';
          const imgTitle = (groups as { title?: string })?.title ?? (title as string);

          // Skip external images
          if (isExternalUrl(imgUrl)) {
            context.log(`responsive-images: skipping external image ${imgUrl}`, 'debug');
            return match;
          }

          // Resolve image path relative to current file
          const imagePath = normalizePath(fileDir, imgUrl);

          // Check cache
          if (processedCache.has(imagePath)) {
            return processedCache.get(imagePath)!;
          }

          // Get image file from files map
          const imageFile = files.get(imagePath);
          if (!imageFile) {
            context.log(`responsive-images: image not found: ${imagePath}`, 'warn');
            return match;
          }

          // Check if it's a supported image
          const isSupported = await processor.isSupported(imageFile.contents.buffer as ArrayBuffer);
          if (!isSupported) {
            context.log(`responsive-images: unsupported format: ${imagePath}`, 'debug');

            // Return simple img tag for unsupported formats (e.g., GIF)
            const simpleHtml = `<picture><img src="${basePath}${imagePath}" alt="${escapeHtml(imgAlt)}"${imgTitle ? ` title="${escapeHtml(imgTitle)}"` : ''} loading="lazy" decoding="async"></picture>`;
            processedCache.set(imagePath, simpleHtml);
            return simpleHtml;
          }

          if (!processImages) {
            // Just transform syntax without processing images
            const simpleHtml = `<picture><img src="${basePath}${imagePath}" alt="${escapeHtml(imgAlt)}"${imgTitle ? ` title="${escapeHtml(imgTitle)}"` : ''} loading="lazy" decoding="async"></picture>`;
            processedCache.set(imagePath, simpleHtml);
            return simpleHtml;
          }

          try {
            // Process the image
            context.log(`responsive-images: processing ${imagePath}`, 'debug');

            const result = await processor.process(
              imageFile.contents.buffer as ArrayBuffer,
              {
                ...processorOptions,
                keepOriginal: true,
              }
            );

            // Get the directory for output images
            const imageDir = getDirectory(imagePath);
            const outputDir = imageDir ? imageDir + '/' : '';

            // Store processed variants
            for (const [, variants] of result.variants) {
              for (const variant of variants) {
                const variantPath = outputDir + variant.name;

                // Add to files map
                files.set(variantPath, {
                  path: variantPath,
                  contents: variant.data,
                  metadata: {
                    width: variant.width,
                    height: variant.height,
                    format: variant.format,
                    generatedFrom: imagePath,
                  },
                  sourcePath: imagePath,
                });

                // Call external storage callback if provided
                if (storeImage) {
                  await storeImage(variantPath, variant.data);
                }
              }
            }

            // Generate picture HTML
            const pictureOptions: ResponsiveImageOptions = {
              alt: imgAlt,
              title: imgTitle,
              className: className || undefined,
              sizes: sizesAttr || undefined,
              caption,
              loading: 'lazy',
              decoding: 'async',
            };

            const pictureHtml = generatePictureHtml(result, basePath + outputDir, pictureOptions);

            context.log(
              `responsive-images: generated ${result.totalVariants} variants for ${imagePath} (${Math.round(result.processingTime)}ms)`,
              'debug'
            );

            processedCache.set(imagePath, pictureHtml);
            return pictureHtml;
          } catch (error) {
            context.log(
              `responsive-images: failed to process ${imagePath}: ${error instanceof Error ? error.message : error}`,
              'error'
            );
            return match;
          }
        }
      );

      // Update file contents
      file.contents = encoder.encode(content);
    }
  };
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default responsiveImages;
