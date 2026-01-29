/**
 * Tests for permalinks plugin
 */
import { describe, it, expect, vi } from 'vitest';
import { permalinks } from './permalinks.js';
import type { VirtualFile, PipelineContext } from '../types.js';
import { createVirtualFile } from '../pipeline.js';

const createTestContext = (): PipelineContext => ({
  config: {
    title: 'Test',
    baseUrl: 'https://example.com',
    sourceDir: 'src',
    outputDir: 'dist',
  },
  metadata: {
    site: { title: 'Test', baseUrl: 'https://example.com' },
    build: { time: new Date(), mode: 'development' },
    collections: new Map(),
  },
  mode: 'development',
  log: vi.fn(),
  templateEngines: new Map(),
  cache: new Map(),
});

describe('Permalinks Plugin', () => {
  describe('default behavior', () => {
    it('should convert .html files to clean URLs', () => {
      const files = new Map<string, VirtualFile>();
      files.set('about.html', createVirtualFile('about.html', '<p>About</p>'));

      const plugin = permalinks();
      plugin(files, createTestContext());

      expect(files.has('about.html')).toBe(false);
      expect(files.has('about/index.html')).toBe(true);
    });

    it('should preserve index.html at root', () => {
      const files = new Map<string, VirtualFile>();
      files.set('index.html', createVirtualFile('index.html', '<p>Home</p>'));

      const plugin = permalinks();
      plugin(files, createTestContext());

      expect(files.has('index.html')).toBe(true);
    });

    it('should preserve nested index.html', () => {
      const files = new Map<string, VirtualFile>();
      files.set('blog/index.html', createVirtualFile('blog/index.html', '<p>Blog</p>'));

      const plugin = permalinks();
      plugin(files, createTestContext());

      expect(files.has('blog/index.html')).toBe(true);
    });

    it('should set permalink metadata', () => {
      const files = new Map<string, VirtualFile>();
      files.set('contact.html', createVirtualFile('contact.html', '<p>Contact</p>'));

      const plugin = permalinks();
      plugin(files, createTestContext());

      const file = files.get('contact/index.html')!;
      expect(file.metadata.permalink).toBe('/contact/');
    });
  });

  describe('pattern option', () => {
    it('should use :basename for file name', () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/my-post.html', createVirtualFile('posts/my-post.html', '<p>Post</p>'));

      const plugin = permalinks({ pattern: ':basename' });
      plugin(files, createTestContext());

      expect(files.has('my-post/index.html')).toBe(true);
    });

    it('should use :directory for path', () => {
      const files = new Map<string, VirtualFile>();
      files.set('blog/2024/post.html', createVirtualFile('blog/2024/post.html', '<p>Post</p>'));

      const plugin = permalinks({ pattern: ':directory/:basename' });
      plugin(files, createTestContext());

      expect(files.has('blog/2024/post/index.html')).toBe(true);
    });

    it('should use :title from metadata', () => {
      const files = new Map<string, VirtualFile>();
      const file = createVirtualFile('post.html', '<p>Post</p>', { title: 'My Great Post' });
      files.set('post.html', file);

      const plugin = permalinks({ pattern: ':title' });
      plugin(files, createTestContext());

      expect(files.has('my-great-post/index.html')).toBe(true);
    });

    it('should use :slug from metadata', () => {
      const files = new Map<string, VirtualFile>();
      const file = createVirtualFile('post.html', '<p>Post</p>', { slug: 'custom-slug' });
      files.set('post.html', file);

      const plugin = permalinks({ pattern: ':slug' });
      plugin(files, createTestContext());

      expect(files.has('custom-slug/index.html')).toBe(true);
    });

    it('should handle date patterns', () => {
      const files = new Map<string, VirtualFile>();
      const file = createVirtualFile('post.html', '<p>Post</p>', {
        title: 'Test',
        date: new Date('2024-03-15'),
      });
      files.set('post.html', file);

      const plugin = permalinks({ pattern: ':year/:month/:day/:title' });
      plugin(files, createTestContext());

      expect(files.has('2024/03/15/test/index.html')).toBe(true);
    });
  });

  describe('trailingSlash option', () => {
    it('should add trailing slash by default', () => {
      const files = new Map<string, VirtualFile>();
      files.set('about.html', createVirtualFile('about.html', '<p>About</p>'));

      const plugin = permalinks();
      plugin(files, createTestContext());

      const file = files.get('about/index.html')!;
      expect(file.metadata.permalink).toBe('/about/');
    });

    it('should not add trailing slash when disabled', () => {
      const files = new Map<string, VirtualFile>();
      files.set('about.html', createVirtualFile('about.html', '<p>About</p>'));

      const plugin = permalinks({ trailingSlash: false });
      plugin(files, createTestContext());

      expect(files.has('about.html')).toBe(true);
    });
  });

  describe('frontmatter permalink', () => {
    it('should use permalink from frontmatter', () => {
      const files = new Map<string, VirtualFile>();
      const file = createVirtualFile('old-path.html', '<p>Content</p>', {
        permalink: '/custom/path/',
      });
      files.set('old-path.html', file);

      const plugin = permalinks();
      plugin(files, createTestContext());

      expect(files.has('custom/path/index.html')).toBe(true);
    });
  });

  describe('unique option', () => {
    it('should append counter for duplicate paths', () => {
      const files = new Map<string, VirtualFile>();
      files.set('a/page.html', createVirtualFile('a/page.html', '<p>A</p>'));
      files.set('b/page.html', createVirtualFile('b/page.html', '<p>B</p>'));

      const plugin = permalinks({ pattern: ':basename', unique: true });
      plugin(files, createTestContext());

      expect(files.has('page/index.html')).toBe(true);
      expect(files.has('page-1/index.html')).toBe(true);
    });
  });

  describe('match option', () => {
    it('should only process matching files', () => {
      const files = new Map<string, VirtualFile>();
      files.set('index.html', createVirtualFile('index.html', '<p>Home</p>'));
      files.set('posts/one.html', createVirtualFile('posts/one.html', '<p>Post</p>'));
      files.set('script.js', createVirtualFile('script.js', 'console.log()'));

      const plugin = permalinks({ match: ['posts/**/*.html'] });
      plugin(files, createTestContext());

      expect(files.has('index.html')).toBe(true); // Not matched, unchanged
      expect(files.has('posts/one/index.html')).toBe(true); // Matched, transformed
      expect(files.has('script.js')).toBe(true); // Not matched, unchanged
    });
  });

  describe('slug function', () => {
    it('should use custom slug function', () => {
      const files = new Map<string, VirtualFile>();
      const file = createVirtualFile('post.html', '<p>Post</p>', { title: 'Hello World' });
      files.set('post.html', file);

      const plugin = permalinks({
        pattern: ':title',
        slug: (text) => text.replace(/\s+/g, '_').toLowerCase(),
      });
      plugin(files, createTestContext());

      expect(files.has('hello_world/index.html')).toBe(true);
    });

    it('should handle diacritics in default slug', () => {
      const files = new Map<string, VirtualFile>();
      const file = createVirtualFile('post.html', '<p>Post</p>', { title: 'Café résumé' });
      files.set('post.html', file);

      const plugin = permalinks({ pattern: ':title' });
      plugin(files, createTestContext());

      expect(files.has('cafe-resume/index.html')).toBe(true);
    });
  });
});
