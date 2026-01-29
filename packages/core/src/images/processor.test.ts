/**
 * Tests for image processor
 *
 * Note: Full image processing tests require browser environment with WebAssembly.
 * These tests focus on helper functions and format detection.
 */
import { describe, it, expect } from 'vitest';
import { ImageProcessor, createImageProcessor } from './processor.js';

describe('ImageProcessor', () => {
  describe('createImageProcessor', () => {
    it('should create an image processor instance', () => {
      const processor = createImageProcessor();
      expect(processor).toBeInstanceOf(ImageProcessor);
    });
  });

  describe('detectFormat', () => {
    it('should detect JPEG format', async () => {
      const processor = createImageProcessor();
      // JPEG magic bytes: FF D8 FF
      const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const format = await processor.detectFormat(jpegData.buffer);
      expect(format).toBe('image/jpeg');
    });

    it('should detect PNG format', async () => {
      const processor = createImageProcessor();
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const format = await processor.detectFormat(pngData.buffer);
      expect(format).toBe('image/png');
    });

    it('should detect WebP format', async () => {
      const processor = createImageProcessor();
      // WebP: RIFF....WEBP
      const webpData = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      const format = await processor.detectFormat(webpData.buffer);
      expect(format).toBe('image/webp');
    });

    it('should detect AVIF format', async () => {
      const processor = createImageProcessor();
      // AVIF: ....ftypavif
      const avifData = new Uint8Array([
        0x00, 0x00, 0x00, 0x00, // size
        0x66, 0x74, 0x79, 0x70, // ftyp
        0x61, 0x76, 0x69, 0x66, // avif
      ]);
      const format = await processor.detectFormat(avifData.buffer);
      expect(format).toBe('image/avif');
    });

    it('should detect GIF format', async () => {
      const processor = createImageProcessor();
      // GIF89a
      const gifData = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      const format = await processor.detectFormat(gifData.buffer);
      expect(format).toBe('image/gif');
    });

    it('should detect BMP format', async () => {
      const processor = createImageProcessor();
      // BM
      const bmpData = new Uint8Array([0x42, 0x4d, 0x00, 0x00]);
      const format = await processor.detectFormat(bmpData.buffer);
      expect(format).toBe('image/bmp');
    });

    it('should return null for unknown format', async () => {
      const processor = createImageProcessor();
      const unknownData = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const format = await processor.detectFormat(unknownData.buffer);
      expect(format).toBeNull();
    });
  });

  describe('isSupported', () => {
    it('should return true for JPEG', async () => {
      const processor = createImageProcessor();
      const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const isSupported = await processor.isSupported(jpegData.buffer);
      expect(isSupported).toBe(true);
    });

    it('should return true for PNG', async () => {
      const processor = createImageProcessor();
      const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const isSupported = await processor.isSupported(pngData.buffer);
      expect(isSupported).toBe(true);
    });

    it('should return true for WebP', async () => {
      const processor = createImageProcessor();
      const webpData = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
      ]);
      const isSupported = await processor.isSupported(webpData.buffer);
      expect(isSupported).toBe(true);
    });

    it('should return false for unknown format', async () => {
      const processor = createImageProcessor();
      const unknownData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const isSupported = await processor.isSupported(unknownData.buffer);
      expect(isSupported).toBe(false);
    });

    it('should handle Blob input', async () => {
      const processor = createImageProcessor();
      const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const blob = new Blob([jpegData], { type: 'image/jpeg' });
      const isSupported = await processor.isSupported(blob);
      expect(isSupported).toBe(true);
    });
  });
});

describe('Format Detection Edge Cases', () => {
  it('should handle minimum data for detection', async () => {
    const processor = createImageProcessor();

    // Just JPEG header
    const jpegMin = new Uint8Array([0xff, 0xd8, 0xff]);
    expect(await processor.detectFormat(jpegMin.buffer)).toBe('image/jpeg');

    // Too short for AVIF (needs 12 bytes)
    const shortData = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x66]);
    expect(await processor.detectFormat(shortData.buffer)).toBeNull();
  });

  it('should handle empty data', async () => {
    const processor = createImageProcessor();
    const emptyData = new Uint8Array([]);
    expect(await processor.detectFormat(emptyData.buffer)).toBeNull();
  });
});
