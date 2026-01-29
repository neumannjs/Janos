/**
 * Image processing types
 *
 * Defines interfaces for browser-based image processing using jSquash WebAssembly codecs.
 */

/**
 * Supported output image formats
 */
export type ImageFormat = 'avif' | 'webp' | 'jpg' | 'png';

/**
 * Named size presets
 */
export type SizePreset = 'xs' | 's' | 'm' | 'l' | 'xl';

/**
 * Size can be a pixel width or a named preset
 */
export type ImageSize = number | SizePreset;

/**
 * Default size presets in pixels
 */
export const SIZE_PRESETS: Record<SizePreset, number> = {
  xs: 320,
  s: 480,
  m: 768,
  l: 1024,
  xl: 1920,
};

/**
 * Encoder quality settings (0-100)
 */
export interface QualitySettings {
  avif?: number;
  webp?: number;
  jpg?: number;
  png?: number; // PNG is lossless, this controls optimization level
}

/**
 * Default quality settings
 */
export const DEFAULT_QUALITY: Required<QualitySettings> = {
  avif: 50, // AVIF has excellent quality at lower settings
  webp: 80,
  jpg: 80,
  png: 3, // oxipng optimization level (0-6)
};

/**
 * Options for image processing
 */
export interface ImageProcessorOptions {
  /** Output formats to generate (default: ['avif', 'webp', 'jpg']) */
  formats?: ImageFormat[];

  /** Output sizes to generate in pixels or presets (default: ['s', 'm', 'l']) */
  sizes?: ImageSize[];

  /** Quality settings per format */
  quality?: QualitySettings;

  /** Maximum dimension (width or height) for the largest size (default: 2048) */
  maxDimension?: number;

  /** Preserve original file (default: true) */
  keepOriginal?: boolean;

  /** Output filename pattern. Placeholders: {name}, {size}, {width}, {format}, {ext} */
  filenamePattern?: string;
}

/**
 * Default processor options
 */
export const DEFAULT_OPTIONS: Required<ImageProcessorOptions> = {
  formats: ['avif', 'webp', 'jpg'],
  sizes: ['s', 'm', 'l'],
  quality: DEFAULT_QUALITY,
  maxDimension: 2048,
  keepOriginal: true,
  filenamePattern: '{name}-{width}.{ext}',
};

/**
 * Result of processing a single image variant
 */
export interface ProcessedImage {
  /** Output filename */
  name: string;

  /** Image format */
  format: ImageFormat;

  /** Width in pixels */
  width: number;

  /** Height in pixels */
  height: number;

  /** Size preset used (if any) */
  sizePreset?: SizePreset;

  /** Binary image data */
  data: Uint8Array;

  /** File size in bytes */
  size: number;
}

/**
 * Result of processing an image into all variants
 */
export interface ImageProcessingResult {
  /** Original image info */
  original: {
    name: string;
    width: number;
    height: number;
    format: string;
    data?: Uint8Array;
  };

  /** Processed variants grouped by format */
  variants: Map<ImageFormat, ProcessedImage[]>;

  /** Total number of variants generated */
  totalVariants: number;

  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Progress callback for long-running operations
 */
export interface ProcessingProgress {
  /** Current step description */
  step: string;

  /** Current progress (0-100) */
  progress: number;

  /** Current format being processed */
  format?: ImageFormat;

  /** Current size being processed */
  size?: number;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: ProcessingProgress) => void;

/**
 * Image processor interface
 */
export interface IImageProcessor {
  /**
   * Process an image file into multiple formats and sizes
   * @param file - Input image file (File, Blob, or ArrayBuffer)
   * @param options - Processing options
   * @param onProgress - Optional progress callback
   * @returns Processing result with all variants
   */
  process(
    file: File | Blob | ArrayBuffer,
    options?: ImageProcessorOptions,
    onProgress?: ProgressCallback
  ): Promise<ImageProcessingResult>;

  /**
   * Detect if a file is a supported image format
   * @param file - File to check
   * @returns True if the file is a supported image
   */
  isSupported(file: File | Blob | ArrayBuffer): Promise<boolean>;

  /**
   * Get the detected format of an image
   * @param file - Image file
   * @returns Detected format or null if not an image
   */
  detectFormat(file: File | Blob | ArrayBuffer): Promise<string | null>;
}

/**
 * MIME types for image formats
 */
export const FORMAT_MIME_TYPES: Record<ImageFormat, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  png: 'image/png',
};

/**
 * File extensions for image formats
 */
export const FORMAT_EXTENSIONS: Record<ImageFormat, string> = {
  avif: 'avif',
  webp: 'webp',
  jpg: 'jpg',
  png: 'png',
};

/**
 * Responsive image HTML generation options
 */
export interface ResponsiveImageOptions {
  /** Alt text for the image */
  alt: string;

  /** Title attribute */
  title?: string;

  /** CSS class to apply */
  className?: string;

  /** Loading strategy */
  loading?: 'lazy' | 'eager';

  /** Decoding hint */
  decoding?: 'async' | 'sync' | 'auto';

  /** Sizes attribute for responsive behavior */
  sizes?: string;

  /** Whether to include width/height attributes */
  includeDimensions?: boolean;

  /** Whether to wrap in figure with caption */
  caption?: boolean;
}

/**
 * Generate responsive <picture> HTML from processed images
 */
export function generatePictureHtml(
  result: ImageProcessingResult,
  basePath: string,
  options: ResponsiveImageOptions
): string {
  const { alt, title, className, loading = 'lazy', decoding = 'async', sizes, includeDimensions = true, caption } = options;

  let html = '<picture>';

  // Add source elements for each format (except jpg which is the fallback)
  const formatOrder: ImageFormat[] = ['avif', 'webp'];

  for (const format of formatOrder) {
    const variants = result.variants.get(format);
    if (!variants || variants.length === 0) continue;

    // Sort by width descending for srcset
    const sorted = [...variants].sort((a, b) => b.width - a.width);

    const srcset = sorted
      .map((v) => `${basePath}${v.name} ${v.width}w`)
      .join(', ');

    html += `<source srcset="${srcset}"`;
    if (sizes) {
      html += ` sizes="${sizes}"`;
    }
    html += ` type="${FORMAT_MIME_TYPES[format]}">`;
  }

  // JPG fallback as <img>
  const jpgVariants = result.variants.get('jpg');
  if (jpgVariants && jpgVariants.length > 0) {
    const sorted = [...jpgVariants].sort((a, b) => b.width - a.width);
    const smallest = sorted[sorted.length - 1]!;
    const largest = sorted[0]!;

    const srcset = sorted
      .map((v) => `${basePath}${v.name} ${v.width}w`)
      .join(', ');

    html += `<img srcset="${srcset}"`;
    if (sizes) {
      html += ` sizes="${sizes}"`;
    }
    html += ` src="${basePath}${smallest.name}"`;
    html += ` alt="${escapeHtml(alt)}"`;
    if (title) {
      html += ` title="${escapeHtml(title)}"`;
    }
    if (className) {
      html += ` class="${escapeHtml(className)}"`;
    }
    html += ` loading="${loading}" decoding="${decoding}"`;

    if (includeDimensions && !sizes) {
      html += ` width="${largest.width}" height="${largest.height}"`;
    }

    html += '>';
  }

  if (caption && title) {
    html += `<figcaption>${escapeHtml(title)}</figcaption>`;
  }

  html += '</picture>';

  return html;
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
