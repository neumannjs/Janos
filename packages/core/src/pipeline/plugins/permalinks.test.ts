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

  describe('linksets', () => {
    it('should apply different patterns based on collection metadata', () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/my-post.html', createVirtualFile('posts/my-post.html', '<p>Post</p>', {
        collection: 'posts',
        title: 'My Post',
        date: new Date('2024-03-15'),
      }));
      files.set('pages/about.html', createVirtualFile('pages/about.html', '<p>About</p>', {
        collection: 'pages',
        title: 'About',
      }));

      const plugin = permalinks({
        linksets: [
          { match: { collection: 'posts' }, pattern: 'blog/:year/:month/:title' },
          { match: { collection: 'pages' }, pattern: ':title' },
        ],
      });
      plugin(files, createTestContext());

      expect(files.has('blog/2024/03/my-post/index.html')).toBe(true);
      expect(files.has('about/index.html')).toBe(true);
    });

    it('should apply different patterns based on file path patterns', () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/my-post.html', createVirtualFile('posts/my-post.html', '<p>Post</p>', {
        title: 'My Post',
      }));
      files.set('docs/guide.html', createVirtualFile('docs/guide.html', '<p>Guide</p>', {
        title: 'Guide',
      }));

      const plugin = permalinks({
        linksets: [
          { match: { pattern: 'posts/**/*.html' }, pattern: 'blog/:title' },
          { match: { pattern: 'docs/**/*.html' }, pattern: 'documentation/:title' },
        ],
      });
      plugin(files, createTestContext());

      expect(files.has('blog/my-post/index.html')).toBe(true);
      expect(files.has('documentation/guide/index.html')).toBe(true);
    });

    it('should fall back to global pattern when no linkset matches', () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/my-post.html', createVirtualFile('posts/my-post.html', '<p>Post</p>', {
        collection: 'posts',
        title: 'My Post',
      }));
      files.set('other/page.html', createVirtualFile('other/page.html', '<p>Page</p>', {
        title: 'Page',
      }));

      const plugin = permalinks({
        pattern: ':basename',
        linksets: [
          { match: { collection: 'posts' }, pattern: 'blog/:title' },
        ],
      });
      plugin(files, createTestContext());

      expect(files.has('blog/my-post/index.html')).toBe(true);
      expect(files.has('page/index.html')).toBe(true);
    });

    it('should allow linksets to override trailing slash setting', () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/post.html', createVirtualFile('posts/post.html', '<p>Post</p>', {
        collection: 'posts',
        title: 'Post',
      }));
      files.set('pages/page.html', createVirtualFile('pages/page.html', '<p>Page</p>', {
        collection: 'pages',
        title: 'Page',
      }));

      const plugin = permalinks({
        trailingSlash: true,
        linksets: [
          { match: { collection: 'posts' }, pattern: 'blog/:title', trailingSlash: false },
          { match: { collection: 'pages' }, pattern: ':title' },
        ],
      });
      plugin(files, createTestContext());

      expect(files.has('blog/post.html')).toBe(true);
      expect(files.has('page/index.html')).toBe(true);
    });

    it('should allow linksets to override slug function', () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/post.html', createVirtualFile('posts/post.html', '<p>Post</p>', {
        collection: 'posts',
        title: 'Hello World',
      }));

      const plugin = permalinks({
        linksets: [
          {
            match: { collection: 'posts' },
            pattern: 'blog/:title',
            slug: (text) => text.replace(/\s+/g, '_').toUpperCase(),
          },
        ],
      });
      plugin(files, createTestContext());

      expect(files.has('blog/HELLO_WORLD/index.html')).toBe(true);
    });

    it('should match files with array metadata values', () => {
      const files = new Map<string, VirtualFile>();
      files.set('post1.html', createVirtualFile('post1.html', '<p>Post 1</p>', {
        title: 'Post 1',
        tags: ['featured', 'news'],
      }));
      files.set('post2.html', createVirtualFile('post2.html', '<p>Post 2</p>', {
        title: 'Post 2',
        tags: ['archive'],
      }));

      const plugin = permalinks({
        pattern: ':basename',
        linksets: [
          { match: { tags: 'featured' }, pattern: 'featured/:title' },
        ],
      });
      plugin(files, createTestContext());

      expect(files.has('featured/post-1/index.html')).toBe(true);
      expect(files.has('post2/index.html')).toBe(true);
    });

    it('should support multiple match criteria in a linkset', () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/featured.html', createVirtualFile('posts/featured.html', '<p>Featured</p>', {
        collection: 'posts',
        featured: true,
        title: 'Featured Post',
      }));
      files.set('posts/regular.html', createVirtualFile('posts/regular.html', '<p>Regular</p>', {
        collection: 'posts',
        featured: false,
        title: 'Regular Post',
      }));

      const plugin = permalinks({
        pattern: ':basename',
        linksets: [
          { match: { collection: 'posts', featured: true }, pattern: 'featured/:title' },
        ],
      });
      plugin(files, createTestContext());

      expect(files.has('featured/featured-post/index.html')).toBe(true);
      expect(files.has('regular/index.html')).toBe(true);
    });

    it('should prioritize earlier linksets', () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', '<p>Post</p>', {
        collection: 'posts',
        category: 'news',
        title: 'Post',
      }));

      const plugin = permalinks({
        linksets: [
          { match: { category: 'news' }, pattern: 'news/:title' },
          { match: { collection: 'posts' }, pattern: 'blog/:title' },
        ],
      });
      plugin(files, createTestContext());

      // Should match the first linkset (category: news) not the second
      expect(files.has('news/post/index.html')).toBe(true);
      expect(files.has('blog/post/index.html')).toBe(false);
    });
  });
});
