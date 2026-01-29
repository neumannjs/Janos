/**
 * Image processor implementation using jSquash WebAssembly codecs
 *
 * Processes images into multiple formats (AVIF, WebP, JPG) and sizes
 * for responsive image delivery.
 */

import type {
  IImageProcessor,
  ImageProcessorOptions,
  ImageProcessingResult,
  ProcessedImage,
  ImageFormat,
  ImageSize,
  SizePreset,
  ProgressCallback,
  QualitySettings,
} from './types.js';

import {
  DEFAULT_OPTIONS,
  DEFAULT_QUALITY,
  SIZE_PRESETS,
  FORMAT_EXTENSIONS,
} from './types.js';

// Dynamic imports for jSquash codecs to support tree-shaking
// and avoid loading unused codecs

/**
 * Decode image data to ImageData using Canvas API (browser) or jSquash codecs
 */
async function decodeImage(
  data: ArrayBuffer,
  mimeType: string
): Promise<ImageData> {
  // Try browser-native decoding first (faster for supported formats)
  if (typeof createImageBitmap !== 'undefined') {
    try {
      const blob = new Blob([data], { type: mimeType });
      const bitmap = await createImageBitmap(blob);

      // Convert ImageBitmap to ImageData via canvas
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    } catch {
      // Fall through to jSquash decoders
    }
  }

  // Use jSquash decoders for formats not supported by browser
  let decoded: ImageData | null = null;

  if (mimeType === 'image/avif' || mimeType.includes('avif')) {
    const { decode } = await import('@jsquash/avif');
    decoded = await decode(data);
  } else if (mimeType === 'image/webp' || mimeType.includes('webp')) {
    const { decode } = await import('@jsquash/webp');
    decoded = await decode(data);
  } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg' || mimeType.includes('jpeg')) {
    const { decode } = await import('@jsquash/jpeg');
    decoded = await decode(data);
  } else if (mimeType === 'image/png' || mimeType.includes('png')) {
    const { decode } = await import('@jsquash/png');
    decoded = await decode(data);
  }

  if (!decoded) {
    throw new Error(`Unsupported image format: ${mimeType}`);
  }

  return decoded;
}

/**
 * Encode ImageData to a specific format
 */
async function encodeImage(
  imageData: ImageData,
  format: ImageFormat,
  quality: QualitySettings
): Promise<Uint8Array> {
  switch (format) {
    case 'avif': {
      const { encode } = await import('@jsquash/avif');
      const result = await encode(imageData, {
        quality: quality.avif ?? DEFAULT_QUALITY.avif,
      });
      return new Uint8Array(result);
    }

    case 'webp': {
      const { encode } = await import('@jsquash/webp');
      const result = await encode(imageData, {
        quality: quality.webp ?? DEFAULT_QUALITY.webp,
      });
      return new Uint8Array(result);
    }

    case 'jpg': {
      const { encode } = await import('@jsquash/jpeg');
      const result = await encode(imageData, {
        quality: quality.jpg ?? DEFAULT_QUALITY.jpg,
      });
      return new Uint8Array(result);
    }

    case 'png': {
      const { encode } = await import('@jsquash/png');
      const result = await encode(imageData);
      // Note: PNG quality is handled differently (optimization level)
      return new Uint8Array(result);
    }

    default:
      throw new Error(`Unsupported output format: ${format}`);
  }
}

/**
 * Resize an image to a target width while maintaining aspect ratio
 */
async function resizeImage(
  imageData: ImageData,
  targetWidth: number
): Promise<ImageData> {
  // Don't upscale images
  if (targetWidth >= imageData.width) {
    return imageData;
  }

  const resizeModule = await import('@jsquash/resize');
  const resize = resizeModule.default;

  const aspectRatio = imageData.height / imageData.width;
  const targetHeight = Math.round(targetWidth * aspectRatio);

  return resize(imageData, {
    width: targetWidth,
    height: targetHeight,
  });
}

/**
 * Detect image MIME type from magic bytes
 */
function detectMimeType(data: ArrayBuffer): string | null {
  const bytes = new Uint8Array(data.slice(0, 16));

  // JPEG: starts with FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: starts with RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // AVIF: starts with ....ftypavif or ....ftypmif1
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 && // 'f'
    bytes[5] === 0x74 && // 't'
    bytes[6] === 0x79 && // 'y'
    bytes[7] === 0x70 // 'p'
  ) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (brand === 'avif' || brand === 'mif1' || brand === 'avis') {
      return 'image/avif';
    }
  }

  // GIF: starts with GIF87a or GIF89a
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }

  // BMP: starts with BM
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

  return null;
}

/**
 * Convert a size specification to pixels
 */
function sizeToPixels(size: ImageSize): number {
  if (typeof size === 'number') {
    return size;
  }
  return SIZE_PRESETS[size];
}

/**
 * Get the size preset name if applicable
 */
function getSizePreset(size: ImageSize): SizePreset | undefined {
  if (typeof size === 'string' && size in SIZE_PRESETS) {
    return size as SizePreset;
  }
  return undefined;
}

/**
 * Extract filename without extension
 */
function getBasename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const lastSlash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
  const start = lastSlash + 1;
  const end = lastDot > lastSlash ? lastDot : filename.length;
  return filename.substring(start, end);
}

/**
 * Generate output filename from pattern
 */
function generateFilename(
  pattern: string,
  originalName: string,
  width: number,
  format: ImageFormat,
  sizePreset?: SizePreset
): string {
  const basename = getBasename(originalName);
  const ext = FORMAT_EXTENSIONS[format];

  return pattern
    .replace('{name}', basename)
    .replace('{size}', sizePreset ?? String(width))
    .replace('{width}', String(width))
    .replace('{format}', format)
    .replace('{ext}', ext);
}

/**
 * Image processor implementation
 */
export class ImageProcessor implements IImageProcessor {
  async process(
    file: File | Blob | ArrayBuffer,
    options: ImageProcessorOptions = {},
    onProgress?: ProgressCallback
  ): Promise<ImageProcessingResult> {
    const startTime = performance.now();

    // Merge with defaults
    const opts = {
      ...DEFAULT_OPTIONS,
      ...options,
      quality: { ...DEFAULT_QUALITY, ...options.quality },
    };

    // Get array buffer
    let buffer: ArrayBuffer;
    let filename: string;

    if (file instanceof ArrayBuffer) {
      buffer = file;
      filename = 'image';
    } else if (file instanceof File) {
      buffer = await file.arrayBuffer();
      filename = file.name;
    } else {
      buffer = await file.arrayBuffer();
      filename = 'image';
    }

    // Detect format
    const mimeType = detectMimeType(buffer);
    if (!mimeType) {
      throw new Error('Unable to detect image format');
    }

    onProgress?.({ step: 'Decoding image', progress: 5 });

    // Decode the image
    const imageData = await decodeImage(buffer, mimeType);

    const originalFormat = (mimeType.split('/')[1] ?? 'unknown').replace('jpeg', 'jpg');

    // Calculate target sizes (filter out sizes larger than original)
    const targetSizes = opts.sizes
      .map((s) => ({
        pixels: Math.min(sizeToPixels(s), imageData.width, opts.maxDimension),
        preset: getSizePreset(s),
      }))
      .filter((s, i, arr) => arr.findIndex((a) => a.pixels === s.pixels) === i) // dedupe
      .sort((a, b) => b.pixels - a.pixels); // largest first

    const variants = new Map<ImageFormat, ProcessedImage[]>();
    let totalVariants = 0;

    const totalSteps = opts.formats.length * targetSizes.length;
    let currentStep = 0;

    onProgress?.({ step: 'Processing variants', progress: 10 });

    // Process each format
    for (const format of opts.formats) {
      const formatVariants: ProcessedImage[] = [];

      for (const targetSize of targetSizes) {
        currentStep++;
        const progress = 10 + Math.round((currentStep / totalSteps) * 85);

        onProgress?.({
          step: `Encoding ${format} @ ${targetSize.pixels}px`,
          progress,
          format,
          size: targetSize.pixels,
        });

        // Resize if needed
        const resized =
          targetSize.pixels < imageData.width
            ? await resizeImage(imageData, targetSize.pixels)
            : imageData;

        // Encode
        const encoded = await encodeImage(resized, format, opts.quality);

        const outputName = generateFilename(
          opts.filenamePattern,
          filename,
          resized.width,
          format,
          targetSize.preset
        );

        formatVariants.push({
          name: outputName,
          format,
          width: resized.width,
          height: resized.height,
          sizePreset: targetSize.preset,
          data: encoded,
          size: encoded.byteLength,
        });

        totalVariants++;
      }

      variants.set(format, formatVariants);
    }

    onProgress?.({ step: 'Complete', progress: 100 });

    const processingTime = performance.now() - startTime;

    return {
      original: {
        name: filename,
        width: imageData.width,
        height: imageData.height,
        format: originalFormat,
        data: opts.keepOriginal ? new Uint8Array(buffer) : undefined,
      },
      variants,
      totalVariants,
      processingTime,
    };
  }

  async isSupported(file: File | Blob | ArrayBuffer): Promise<boolean> {
    const format = await this.detectFormat(file);
    return format !== null;
  }

  async detectFormat(file: File | Blob | ArrayBuffer): Promise<string | null> {
    let buffer: ArrayBuffer;

    if (file instanceof ArrayBuffer) {
      buffer = file;
    } else {
      // Only read first 16 bytes for detection
      const slice = file.slice(0, 16);
      buffer = await slice.arrayBuffer();
    }

    return detectMimeType(buffer);
  }
}

/**
 * Create a new image processor instance
 */
export function createImageProcessor(): IImageProcessor {
  return new ImageProcessor();
}

/**
 * Default processor instance
 */
export const defaultImageProcessor = new ImageProcessor();
