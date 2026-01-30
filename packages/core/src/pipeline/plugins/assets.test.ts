/**
 * Tests for assets plugin
 */
import { describe, it, expect } from 'vitest';
import { assets } from './assets.js';
import { createVirtualFile, getFileContents } from '../pipeline.js';
import type { VirtualFile, PipelineContext } from '../types.js';

function createTestContext(): PipelineContext {
  return {
    config: {
      site: {
        title: 'Test Site',
        baseUrl: 'https://example.com',
        sourceDir: '_src',
        outputDir: '/',
      },
      mode: 'development',
    },
    metadata: {
      collections: {},
    },
    templateEngines: new Map(),
    log: () => {},
  };
}

describe('assets plugin', () => {
  describe('basic copying', () => {
    it('should copy files from source to destination', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('_assets/styles/main.css', createVirtualFile('_assets/styles/main.css', 'body { color: black; }'));
      files.set('_assets/scripts/app.js', createVirtualFile('_assets/scripts/app.js', 'console.log("hello");'));

      const context = createTestContext();
      const plugin = assets({
        source: '_assets',
        destination: '/',
      });

      await plugin(files, context);

      expect(files.has('styles/main.css')).toBe(true);
      expect(files.has('scripts/app.js')).toBe(true);
      expect(getFileContents(files.get('styles/main.css')!)).toBe('body { color: black; }');
    });

    it('should copy to specified destination directory', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('_src/images/logo.png', createVirtualFile('_src/images/logo.png', 'PNG data'));
      files.set('_src/images/icon.svg', createVirtualFile('_src/images/icon.svg', '<svg></svg>'));

      const context = createTestContext();
      const plugin = assets({
        source: '_src/images',
        destination: '/images',
      });

      await plugin(files, context);

      expect(files.has('images/logo.png')).toBe(true);
      expect(files.has('images/icon.svg')).toBe(true);
    });

    it('should preserve nested directory structure', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('assets/css/main.css', createVirtualFile('assets/css/main.css', 'css'));
      files.set('assets/css/components/button.css', createVirtualFile('assets/css/components/button.css', 'button'));
      files.set('assets/fonts/regular.woff2', createVirtualFile('assets/fonts/regular.woff2', 'font'));

      const context = createTestContext();
      const plugin = assets({
        source: 'assets',
        destination: 'static',
      });

      await plugin(files, context);

      expect(files.has('static/css/main.css')).toBe(true);
      expect(files.has('static/css/components/button.css')).toBe(true);
      expect(files.has('static/fonts/regular.woff2')).toBe(true);
    });
  });

  describe('multiple sources', () => {
    it('should copy from multiple sources', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('_layouts/miksa/assets/style.css', createVirtualFile('_layouts/miksa/assets/style.css', 'css'));
      files.set('_src/images/photo.jpg', createVirtualFile('_src/images/photo.jpg', 'jpg'));

      const context = createTestContext();
      const plugin = assets({
        sources: [
          { source: '_layouts/miksa/assets', destination: '/' },
          { source: '_src/images', destination: '/images' },
        ],
      });

      await plugin(files, context);

      expect(files.has('style.css')).toBe(true);
      expect(files.has('images/photo.jpg')).toBe(true);
    });

    it('should handle overlapping destinations', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('theme/assets/theme.css', createVirtualFile('theme/assets/theme.css', 'theme'));
      files.set('custom/assets/custom.css', createVirtualFile('custom/assets/custom.css', 'custom'));

      const context = createTestContext();
      const plugin = assets({
        sources: [
          { source: 'theme/assets', destination: '/css' },
          { source: 'custom/assets', destination: '/css' },
        ],
      });

      await plugin(files, context);

      expect(files.has('css/theme.css')).toBe(true);
      expect(files.has('css/custom.css')).toBe(true);
    });
  });

  describe('path normalization', () => {
    it('should handle paths with leading slashes', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('assets/file.txt', createVirtualFile('assets/file.txt', 'content'));

      const context = createTestContext();
      const plugin = assets({
        source: '/assets/',
        destination: '/output/',
      });

      await plugin(files, context);

      expect(files.has('output/file.txt')).toBe(true);
    });

    it('should handle destination as root', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('static/app.js', createVirtualFile('static/app.js', 'js'));

      const context = createTestContext();
      const plugin = assets({
        source: 'static',
        destination: '/',
      });

      await plugin(files, context);

      expect(files.has('app.js')).toBe(true);
    });

    it('should default destination to root', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('public/index.css', createVirtualFile('public/index.css', 'css'));

      const context = createTestContext();
      const plugin = assets({
        source: 'public',
      });

      await plugin(files, context);

      expect(files.has('index.css')).toBe(true);
    });
  });

  describe('file metadata', () => {
    it('should preserve file metadata', async () => {
      const files = new Map<string, VirtualFile>();
      const file = createVirtualFile('assets/data.json', '{}');
      file.metadata = { title: 'Data', custom: true };
      files.set('assets/data.json', file);

      const context = createTestContext();
      const plugin = assets({
        source: 'assets',
        destination: 'output',
      });

      await plugin(files, context);

      const copied = files.get('output/data.json')!;
      expect(copied.metadata.title).toBe('Data');
      expect(copied.metadata.custom).toBe(true);
    });

    it('should set sourcePath on copied files', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('src/file.txt', createVirtualFile('src/file.txt', 'content'));

      const context = createTestContext();
      const plugin = assets({
        source: 'src',
        destination: 'dest',
      });

      await plugin(files, context);

      const copied = files.get('dest/file.txt')!;
      expect(copied.sourcePath).toBe('src/file.txt');
    });
  });

  describe('empty and missing sources', () => {
    it('should handle empty source directory', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('other/file.txt', createVirtualFile('other/file.txt', 'content'));

      const context = createTestContext();
      const plugin = assets({
        source: 'empty',
        destination: 'output',
      });

      await plugin(files, context);

      // Should not throw, just skip
      expect(files.has('output/file.txt')).toBe(false);
    });

    it('should handle no sources configured', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('file.txt', createVirtualFile('file.txt', 'content'));

      const context = createTestContext();
      const plugin = assets({});

      await plugin(files, context);

      // Should not throw
      expect(files.size).toBe(1);
    });
  });

  describe('binary files', () => {
    it('should preserve binary content', async () => {
      const files = new Map<string, VirtualFile>();
      const binaryContent = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const file: VirtualFile = {
        path: 'assets/image.png',
        contents: binaryContent,
        metadata: {},
        sourcePath: 'assets/image.png',
      };
      files.set('assets/image.png', file);

      const context = createTestContext();
      const plugin = assets({
        source: 'assets',
        destination: 'images',
      });

      await plugin(files, context);

      const copied = files.get('images/image.png')!;
      expect(copied.contents).toEqual(binaryContent);
    });
  });

  describe('original files', () => {
    it('should keep original files in place', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('assets/file.txt', createVirtualFile('assets/file.txt', 'content'));

      const context = createTestContext();
      const plugin = assets({
        source: 'assets',
        destination: 'output',
      });

      await plugin(files, context);

      // Original should still exist
      expect(files.has('assets/file.txt')).toBe(true);
      // Copy should also exist
      expect(files.has('output/file.txt')).toBe(true);
    });
  });
});
