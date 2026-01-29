/**
 * Tests for image processing types and utilities
 */
import { describe, it, expect } from 'vitest';
import {
  SIZE_PRESETS,
  DEFAULT_QUALITY,
  DEFAULT_OPTIONS,
  FORMAT_MIME_TYPES,
  FORMAT_EXTENSIONS,
  generatePictureHtml,
  type ImageProcessingResult,
  type ProcessedImage,
} from './types.js';

describe('Image Types', () => {
  describe('SIZE_PRESETS', () => {
    it('should have all size presets defined', () => {
      expect(SIZE_PRESETS.xs).toBe(320);
      expect(SIZE_PRESETS.s).toBe(480);
      expect(SIZE_PRESETS.m).toBe(768);
      expect(SIZE_PRESETS.l).toBe(1024);
      expect(SIZE_PRESETS.xl).toBe(1920);
    });
  });

  describe('DEFAULT_QUALITY', () => {
    it('should have quality settings for all formats', () => {
      expect(DEFAULT_QUALITY.avif).toBeDefined();
      expect(DEFAULT_QUALITY.webp).toBeDefined();
      expect(DEFAULT_QUALITY.jpg).toBeDefined();
      expect(DEFAULT_QUALITY.png).toBeDefined();
    });

    it('should have reasonable quality values', () => {
      expect(DEFAULT_QUALITY.avif).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_QUALITY.avif).toBeLessThanOrEqual(100);
      expect(DEFAULT_QUALITY.webp).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_QUALITY.webp).toBeLessThanOrEqual(100);
      expect(DEFAULT_QUALITY.jpg).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_QUALITY.jpg).toBeLessThanOrEqual(100);
    });
  });

  describe('DEFAULT_OPTIONS', () => {
    it('should have default formats', () => {
      expect(DEFAULT_OPTIONS.formats).toContain('avif');
      expect(DEFAULT_OPTIONS.formats).toContain('webp');
      expect(DEFAULT_OPTIONS.formats).toContain('jpg');
    });

    it('should have default sizes', () => {
      expect(DEFAULT_OPTIONS.sizes).toEqual(['s', 'm', 'l']);
    });

    it('should have filename pattern', () => {
      expect(DEFAULT_OPTIONS.filenamePattern).toContain('{name}');
      expect(DEFAULT_OPTIONS.filenamePattern).toContain('{width}');
      expect(DEFAULT_OPTIONS.filenamePattern).toContain('{ext}');
    });
  });

  describe('FORMAT_MIME_TYPES', () => {
    it('should map formats to correct MIME types', () => {
      expect(FORMAT_MIME_TYPES.avif).toBe('image/avif');
      expect(FORMAT_MIME_TYPES.webp).toBe('image/webp');
      expect(FORMAT_MIME_TYPES.jpg).toBe('image/jpeg');
      expect(FORMAT_MIME_TYPES.png).toBe('image/png');
    });
  });

  describe('FORMAT_EXTENSIONS', () => {
    it('should map formats to correct extensions', () => {
      expect(FORMAT_EXTENSIONS.avif).toBe('avif');
      expect(FORMAT_EXTENSIONS.webp).toBe('webp');
      expect(FORMAT_EXTENSIONS.jpg).toBe('jpg');
      expect(FORMAT_EXTENSIONS.png).toBe('png');
    });
  });
});

describe('generatePictureHtml', () => {
  const createMockResult = (): ImageProcessingResult => {
    const avifVariants: ProcessedImage[] = [
      { name: 'test-1024.avif', format: 'avif', width: 1024, height: 768, data: new Uint8Array(), size: 1000 },
      { name: 'test-768.avif', format: 'avif', width: 768, height: 576, data: new Uint8Array(), size: 800 },
      { name: 'test-480.avif', format: 'avif', width: 480, height: 360, data: new Uint8Array(), size: 500 },
    ];

    const webpVariants: ProcessedImage[] = [
      { name: 'test-1024.webp', format: 'webp', width: 1024, height: 768, data: new Uint8Array(), size: 1200 },
      { name: 'test-768.webp', format: 'webp', width: 768, height: 576, data: new Uint8Array(), size: 900 },
      { name: 'test-480.webp', format: 'webp', width: 480, height: 360, data: new Uint8Array(), size: 600 },
    ];

    const jpgVariants: ProcessedImage[] = [
      { name: 'test-1024.jpg', format: 'jpg', width: 1024, height: 768, data: new Uint8Array(), size: 1500 },
      { name: 'test-768.jpg', format: 'jpg', width: 768, height: 576, data: new Uint8Array(), size: 1100 },
      { name: 'test-480.jpg', format: 'jpg', width: 480, height: 360, data: new Uint8Array(), size: 700 },
    ];

    const variants = new Map();
    variants.set('avif', avifVariants);
    variants.set('webp', webpVariants);
    variants.set('jpg', jpgVariants);

    return {
      original: { name: 'test.jpg', width: 1024, height: 768, format: 'jpg' },
      variants,
      totalVariants: 9,
      processingTime: 1000,
    };
  };

  it('should generate picture element with sources', () => {
    const result = createMockResult();
    const html = generatePictureHtml(result, '/images/', { alt: 'Test image' });

    expect(html).toContain('<picture>');
    expect(html).toContain('</picture>');
    expect(html).toContain('<source');
    expect(html).toContain('type="image/avif"');
    expect(html).toContain('type="image/webp"');
  });

  it('should include img fallback', () => {
    const result = createMockResult();
    const html = generatePictureHtml(result, '/images/', { alt: 'Test image' });

    expect(html).toContain('<img');
    expect(html).toContain('alt="Test image"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it('should include srcset for each source', () => {
    const result = createMockResult();
    const html = generatePictureHtml(result, '/images/', { alt: 'Test image' });

    expect(html).toContain('srcset=');
    expect(html).toContain('1024w');
    expect(html).toContain('768w');
    expect(html).toContain('480w');
  });

  it('should escape HTML in alt text', () => {
    const result = createMockResult();
    const html = generatePictureHtml(result, '/images/', { alt: 'Test <script>alert("xss")</script>' });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should include title when provided', () => {
    const result = createMockResult();
    const html = generatePictureHtml(result, '/images/', {
      alt: 'Test image',
      title: 'Image title',
    });

    expect(html).toContain('title="Image title"');
  });

  it('should include sizes attribute when provided', () => {
    const result = createMockResult();
    const html = generatePictureHtml(result, '/images/', {
      alt: 'Test image',
      sizes: '(max-width: 600px) 100vw, 50vw',
    });

    expect(html).toContain('sizes="(max-width: 600px) 100vw, 50vw"');
  });

  it('should include width/height when includeDimensions is true and no sizes', () => {
    const result = createMockResult();
    const html = generatePictureHtml(result, '/images/', {
      alt: 'Test image',
      includeDimensions: true,
    });

    expect(html).toContain('width="1024"');
    expect(html).toContain('height="768"');
  });

  it('should not include width/height when sizes is set', () => {
    const result = createMockResult();
    const html = generatePictureHtml(result, '/images/', {
      alt: 'Test image',
      includeDimensions: true,
      sizes: '100vw',
    });

    expect(html).not.toContain('width="1024"');
    expect(html).not.toContain('height="768"');
  });

  it('should add figcaption when caption is true and title is set', () => {
    const result = createMockResult();
    const html = generatePictureHtml(result, '/images/', {
      alt: 'Test image',
      title: 'Image caption',
      caption: true,
    });

    expect(html).toContain('<figcaption>Image caption</figcaption>');
  });

  it('should include class when provided', () => {
    const result = createMockResult();
    const html = generatePictureHtml(result, '/images/', {
      alt: 'Test image',
      className: 'responsive-img',
    });

    expect(html).toContain('class="responsive-img"');
  });

  it('should use custom loading strategy', () => {
    const result = createMockResult();
    const html = generatePictureHtml(result, '/images/', {
      alt: 'Test image',
      loading: 'eager',
    });

    expect(html).toContain('loading="eager"');
  });

  it('should handle empty variants gracefully', () => {
    const result: ImageProcessingResult = {
      original: { name: 'test.jpg', width: 1024, height: 768, format: 'jpg' },
      variants: new Map(),
      totalVariants: 0,
      processingTime: 100,
    };

    const html = generatePictureHtml(result, '/images/', { alt: 'Test image' });

    expect(html).toBe('<picture></picture>');
  });
});
