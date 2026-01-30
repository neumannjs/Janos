/**
 * Browser-based integration tests for image processor
 *
 * These tests require a browser environment to run the WebAssembly codecs.
 * Run with: npx vitest --browser
 */
import { describe, it, expect } from 'vitest';

// Skip these tests in Node.js environment
const isBrowser = typeof window !== 'undefined' && typeof createImageBitmap !== 'undefined';

describe.skipIf(!isBrowser)('ImageProcessor Browser Integration', () => {
  // Create a simple test image using Canvas
  async function createTestImage(width: number, height: number, color: string): Promise<ArrayBuffer> {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;

    // Fill with color
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    // Add some variation
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(width / 4, height / 4, width / 2, height / 2);

    // Convert to PNG blob
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blob.arrayBuffer();
  }

  it('should process a test image to multiple formats', async () => {
    // Dynamic import to avoid Node.js issues
    const { createImageProcessor } = await import('./processor.js');
    const processor = createImageProcessor();

    // Create a 200x150 test image
    const testImage = await createTestImage(200, 150, '#4a90d9');

    // Verify it's detected as PNG
    const format = await processor.detectFormat(testImage);
    expect(format).toBe('image/png');

    // Process the image
    const result = await processor.process(testImage, {
      formats: ['webp', 'jpg'], // Skip AVIF for faster tests
      sizes: [100, 200], // Small sizes for speed
      quality: { webp: 80, jpg: 80 },
    });

    // Verify results
    expect(result.original.width).toBe(200);
    expect(result.original.height).toBe(150);
    expect(result.totalVariants).toBe(4); // 2 formats × 2 sizes

    // Check WebP variants
    const webpVariants = result.variants.get('webp');
    expect(webpVariants).toBeDefined();
    expect(webpVariants!.length).toBe(2);

    // Check JPG variants
    const jpgVariants = result.variants.get('jpg');
    expect(jpgVariants).toBeDefined();
    expect(jpgVariants!.length).toBe(2);

    // Verify sizes
    const sortedWebp = [...webpVariants!].sort((a, b) => b.width - a.width);
    expect(sortedWebp[0].width).toBe(200);
    expect(sortedWebp[1].width).toBe(100);

    // Verify data is not empty
    for (const variant of [...webpVariants!, ...jpgVariants!]) {
      expect(variant.data.byteLength).toBeGreaterThan(0);
    }
  });

  it('should not upscale images', async () => {
    const { createImageProcessor } = await import('./processor.js');
    const processor = createImageProcessor();

    // Create a small 50x50 image
    const smallImage = await createTestImage(50, 50, '#ff0000');

    const result = await processor.process(smallImage, {
      formats: ['jpg'],
      sizes: [100, 200, 50], // Request larger sizes than original
    });

    // Should only have one size (the original 50px)
    const jpgVariants = result.variants.get('jpg');
    expect(jpgVariants!.length).toBe(1);
    expect(jpgVariants![0].width).toBe(50);
  });

  it('should report progress during processing', async () => {
    const { createImageProcessor } = await import('./processor.js');
    const processor = createImageProcessor();

    const testImage = await createTestImage(100, 100, '#00ff00');
    const progressUpdates: string[] = [];

    await processor.process(
      testImage,
      {
        formats: ['jpg'],
        sizes: [50],
      },
      (progress) => {
        progressUpdates.push(progress.step);
      }
    );

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates).toContain('Decoding image');
    expect(progressUpdates).toContain('Complete');
  });

  it('should maintain aspect ratio when resizing', async () => {
    const { createImageProcessor } = await import('./processor.js');
    const processor = createImageProcessor();

    // Create a 400x200 image (2:1 aspect ratio)
    const wideImage = await createTestImage(400, 200, '#0000ff');

    const result = await processor.process(wideImage, {
      formats: ['jpg'],
      sizes: [200],
    });

    const jpgVariants = result.variants.get('jpg');
    const variant = jpgVariants![0];

    // Should be 200x100 (maintaining 2:1 ratio)
    expect(variant.width).toBe(200);
    expect(variant.height).toBe(100);
  });
});
