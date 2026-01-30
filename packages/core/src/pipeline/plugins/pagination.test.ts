/**
 * Tests for pagination plugin
 */
import { describe, it, expect } from 'vitest';
import { pagination } from './pagination.js';
import type { VirtualFile, PipelineContext } from '../types.js';
import type { PaginationData } from './pagination.js';

function createTestContext(collections: Record<string, unknown[]> = {}): PipelineContext {
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
      collections,
    },
    templateEngines: new Map(),
    log: () => {},
  };
}

function createPost(num: number, date: string) {
  return {
    path: `posts/post-${num}.html`,
    title: `Post ${num}`,
    date: new Date(date),
  };
}

describe('pagination plugin', () => {
  describe('basic pagination', () => {
    it('should create pages from collection', async () => {
      const files = new Map<string, VirtualFile>();
      const posts = [
        createPost(1, '2024-01-01'),
        createPost(2, '2024-01-02'),
        createPost(3, '2024-01-03'),
        createPost(4, '2024-01-04'),
        createPost(5, '2024-01-05'),
      ];

      const context = createTestContext({ posts });
      const plugin = pagination({
        'collections.posts': {
          perPage: 2,
          first: 'index.html',
          path: 'posts/:num/index.html',
        },
      });

      await plugin(files, context);

      // Should create 3 pages (5 posts / 2 per page = 3)
      expect(files.has('index.html')).toBe(true);
      expect(files.has('posts/2/index.html')).toBe(true);
      expect(files.has('posts/3/index.html')).toBe(true);
    });

    it('should include pagination data in metadata', async () => {
      const files = new Map<string, VirtualFile>();
      const posts = [
        createPost(1, '2024-01-01'),
        createPost(2, '2024-01-02'),
        createPost(3, '2024-01-03'),
      ];

      const context = createTestContext({ posts });
      const plugin = pagination({
        'collections.posts': {
          perPage: 2,
          first: 'index.html',
          path: 'page/:num/index.html',
        },
      });

      await plugin(files, context);

      const page1 = files.get('index.html')!;
      const pagination1 = page1.metadata.pagination as PaginationData;

      expect(pagination1.files).toHaveLength(2);
      expect(pagination1.current).toBe(1);
      expect(pagination1.total).toBe(2);
      expect(pagination1.previous).toBeNull();
      expect(pagination1.next).toEqual({ num: 2, path: 'page/2/index.html' });
      expect(pagination1.pages).toHaveLength(2);

      const page2 = files.get('page/2/index.html')!;
      const pagination2 = page2.metadata.pagination as PaginationData;

      expect(pagination2.files).toHaveLength(1);
      expect(pagination2.current).toBe(2);
      expect(pagination2.previous).toEqual({ num: 1, path: 'index.html' });
      expect(pagination2.next).toBeNull();
    });

    it('should support perPage option', async () => {
      const files = new Map<string, VirtualFile>();
      const posts = Array.from({ length: 10 }, (_, i) =>
        createPost(i + 1, `2024-01-${String(i + 1).padStart(2, '0')}`)
      );

      const context = createTestContext({ posts });
      const plugin = pagination({
        'collections.posts': {
          perPage: 4,
          first: 'index.html',
          path: 'page/:num/index.html',
        },
      });

      await plugin(files, context);

      // 10 posts / 4 per page = 3 pages
      expect(files.size).toBe(3);

      const page1 = files.get('index.html')!;
      expect((page1.metadata.pagination as PaginationData).files).toHaveLength(4);

      const page3 = files.get('page/3/index.html')!;
      expect((page3.metadata.pagination as PaginationData).files).toHaveLength(2);
    });
  });

  describe('layout and metadata', () => {
    it('should set layout on pages', async () => {
      const files = new Map<string, VirtualFile>();
      const posts = [createPost(1, '2024-01-01')];

      const context = createTestContext({ posts });
      const plugin = pagination({
        'collections.posts': {
          perPage: 10,
          first: 'index.html',
          path: 'page/:num/index.html',
          layout: 'home.njk',
        },
      });

      await plugin(files, context);

      const page = files.get('index.html')!;
      expect(page.metadata.layout).toBe('home.njk');
    });

    it('should add pageMetadata to pages', async () => {
      const files = new Map<string, VirtualFile>();
      const posts = [createPost(1, '2024-01-01')];

      const context = createTestContext({ posts });
      const plugin = pagination({
        'collections.posts': {
          perPage: 10,
          first: 'index.html',
          path: 'page/:num/index.html',
          pageMetadata: {
            title: 'Blog Archive',
            description: 'All posts',
          },
        },
      });

      await plugin(files, context);

      const page = files.get('index.html')!;
      expect(page.metadata.title).toBe('Blog Archive');
      expect(page.metadata.description).toBe('All posts');
    });
  });

  describe('path patterns', () => {
    it('should replace :num in path pattern', async () => {
      const files = new Map<string, VirtualFile>();
      const posts = [createPost(1, '2024-01-01'), createPost(2, '2024-01-02')];

      const context = createTestContext({ posts });
      const plugin = pagination({
        'collections.posts': {
          perPage: 1,
          first: 'blog/index.html',
          path: 'blog/page-:num/index.html',
        },
      });

      await plugin(files, context);

      expect(files.has('blog/index.html')).toBe(true);
      expect(files.has('blog/page-2/index.html')).toBe(true);
    });

    it('should use first path for page 1', async () => {
      const files = new Map<string, VirtualFile>();
      const posts = [createPost(1, '2024-01-01'), createPost(2, '2024-01-02')];

      const context = createTestContext({ posts });
      const plugin = pagination({
        'collections.posts': {
          perPage: 1,
          first: 'articles.html',
          path: 'articles/:num.html',
        },
      });

      await plugin(files, context);

      expect(files.has('articles.html')).toBe(true);
      expect(files.has('articles/2.html')).toBe(true);
    });
  });

  describe('navigation', () => {
    it('should provide next and previous page info', async () => {
      const files = new Map<string, VirtualFile>();
      const posts = [
        createPost(1, '2024-01-01'),
        createPost(2, '2024-01-02'),
        createPost(3, '2024-01-03'),
      ];

      const context = createTestContext({ posts });
      const plugin = pagination({
        'collections.posts': {
          perPage: 1,
          first: 'index.html',
          path: 'page/:num/index.html',
        },
      });

      await plugin(files, context);

      const page1 = files.get('index.html')!;
      const page2 = files.get('page/2/index.html')!;
      const page3 = files.get('page/3/index.html')!;

      expect((page1.metadata.pagination as PaginationData).previous).toBeNull();
      expect((page1.metadata.pagination as PaginationData).next?.path).toBe('page/2/index.html');

      expect((page2.metadata.pagination as PaginationData).previous?.path).toBe('index.html');
      expect((page2.metadata.pagination as PaginationData).next?.path).toBe('page/3/index.html');

      expect((page3.metadata.pagination as PaginationData).previous?.path).toBe('page/2/index.html');
      expect((page3.metadata.pagination as PaginationData).next).toBeNull();
    });

    it('should include all pages in pages array', async () => {
      const files = new Map<string, VirtualFile>();
      const posts = Array.from({ length: 5 }, (_, i) =>
        createPost(i + 1, `2024-01-${String(i + 1).padStart(2, '0')}`)
      );

      const context = createTestContext({ posts });
      const plugin = pagination({
        'collections.posts': {
          perPage: 2,
          first: 'index.html',
          path: 'page/:num/index.html',
        },
      });

      await plugin(files, context);

      const page1 = files.get('index.html')!;
      const pages = (page1.metadata.pagination as PaginationData).pages;

      expect(pages).toHaveLength(3);
      expect(pages[0]).toEqual({ num: 1, path: 'index.html' });
      expect(pages[1]).toEqual({ num: 2, path: 'page/2/index.html' });
      expect(pages[2]).toEqual({ num: 3, path: 'page/3/index.html' });
    });
  });

  describe('empty and missing collections', () => {
    it('should handle missing collection gracefully', async () => {
      const files = new Map<string, VirtualFile>();
      const context = createTestContext({});

      const plugin = pagination({
        'collections.posts': {
          perPage: 10,
          first: 'index.html',
          path: 'page/:num/index.html',
        },
      });

      await plugin(files, context);

      expect(files.size).toBe(0);
    });

    it('should handle empty collection', async () => {
      const files = new Map<string, VirtualFile>();
      const context = createTestContext({ posts: [] });

      const plugin = pagination({
        'collections.posts': {
          perPage: 10,
          first: 'index.html',
          path: 'page/:num/index.html',
        },
      });

      await plugin(files, context);

      expect(files.size).toBe(0);
    });
  });

  describe('multiple collections', () => {
    it('should paginate multiple collections', async () => {
      const files = new Map<string, VirtualFile>();
      const posts = [createPost(1, '2024-01-01'), createPost(2, '2024-01-02')];
      const events = [
        { path: 'events/1.html', title: 'Event 1' },
        { path: 'events/2.html', title: 'Event 2' },
      ];

      const context = createTestContext({ posts, events });
      const plugin = pagination({
        'collections.posts': {
          perPage: 1,
          first: 'blog/index.html',
          path: 'blog/:num/index.html',
        },
        'collections.events': {
          perPage: 1,
          first: 'events/index.html',
          path: 'events/:num/index.html',
        },
      });

      await plugin(files, context);

      expect(files.has('blog/index.html')).toBe(true);
      expect(files.has('blog/2/index.html')).toBe(true);
      expect(files.has('events/index.html')).toBe(true);
      expect(files.has('events/2/index.html')).toBe(true);
    });
  });

  describe('filtering', () => {
    it('should support filter function', async () => {
      const files = new Map<string, VirtualFile>();
      const posts = [
        { ...createPost(1, '2024-01-01'), draft: true },
        { ...createPost(2, '2024-01-02'), draft: false },
        { ...createPost(3, '2024-01-03'), draft: false },
      ];

      const context = createTestContext({ posts });
      const plugin = pagination({
        'collections.posts': {
          perPage: 10,
          first: 'index.html',
          path: 'page/:num/index.html',
          filter: (post: any) => !post.draft,
        },
      });

      await plugin(files, context);

      const page = files.get('index.html')!;
      const paginationData = page.metadata.pagination as PaginationData;

      expect(paginationData.files).toHaveLength(2);
      expect(paginationData.total).toBe(1);
    });
  });
});
