/**
 * Image processing module
 *
 * Provides browser-based image processing using jSquash WebAssembly codecs
 * for generating responsive images in multiple formats and sizes.
 */

// Types
export type {
  ImageFormat,
  SizePreset,
  ImageSize,
  QualitySettings,
  ImageProcessorOptions,
  ProcessedImage,
  ImageProcessingResult,
  ProcessingProgress,
  ProgressCallback,
  IImageProcessor,
  ResponsiveImageOptions,
} from './types.js';

// Constants
export {
  SIZE_PRESETS,
  DEFAULT_QUALITY,
  DEFAULT_OPTIONS,
  FORMAT_MIME_TYPES,
  FORMAT_EXTENSIONS,
} from './types.js';

// Utilities
export { generatePictureHtml } from './types.js';

// Processor
export {
  ImageProcessor,
  createImageProcessor,
  defaultImageProcessor,
} from './processor.js';
