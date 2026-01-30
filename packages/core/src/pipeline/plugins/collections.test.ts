/**
 * Tests for collections plugin
 */
import { describe, it, expect } from 'vitest';
import { collections } from './collections.js';
import { createVirtualFile } from '../pipeline.js';
import { parseFrontmatter } from '../frontmatter.js';
import type { VirtualFile, PipelineContext } from '../types.js';

/**
 * Create a virtual file with frontmatter parsed into metadata
 */
function createFileWithFrontmatter(path: string, content: string): VirtualFile {
  const file = createVirtualFile(path, content);
  const { metadata, content: body } = parseFrontmatter(content);
  file.metadata = metadata || {};
  file.contents = new TextEncoder().encode(body);
  return file;
}

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

describe('collections plugin', () => {
  describe('pattern-based collections', () => {
    it('should collect files matching a glob pattern', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/first.md', createFileWithFrontmatter('posts/first.md', `---
title: First Post
date: 2024-01-01
---
Content 1`));
      files.set('posts/second.md', createFileWithFrontmatter('posts/second.md', `---
title: Second Post
date: 2024-01-02
---
Content 2`));
      files.set('pages/about.md', createFileWithFrontmatter('pages/about.md', `---
title: About
---
About content`));

      const context = createTestContext();
      const plugin = collections({
        posts: {
          pattern: 'posts/**/*.md',
        },
      });

      await plugin(files, context);

      const postsCollection = (context.metadata.collections as Record<string, unknown[]>).posts;
      expect(postsCollection).toHaveLength(2);
      expect(postsCollection.map((p: any) => p.title)).toContain('First Post');
      expect(postsCollection.map((p: any) => p.title)).toContain('Second Post');
    });

    it('should support multiple patterns', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/post.md', createFileWithFrontmatter('posts/post.md', `---
title: Post
date: 2024-01-01
---
`));
      files.set('stream/note.md', createFileWithFrontmatter('stream/note.md', `---
title: Note
date: 2024-01-02
---
`));
      files.set('pages/about.md', createFileWithFrontmatter('pages/about.md', `---
title: About
---
`));

      const context = createTestContext();
      const plugin = collections({
        stream: {
          pattern: ['posts/**/*.md', 'stream/**/*.md'],
        },
      });

      await plugin(files, context);

      const streamCollection = (context.metadata.collections as Record<string, unknown[]>).stream;
      expect(streamCollection).toHaveLength(2);
      expect(streamCollection.map((p: any) => p.title)).toContain('Post');
      expect(streamCollection.map((p: any) => p.title)).toContain('Note');
    });
  });

  describe('metadata-based collections', () => {
    it('should collect files with collection in frontmatter', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('nav/home.md', createFileWithFrontmatter('nav/home.md', `---
label: Home
collection: navigation
sortId: 0
---
`));
      files.set('nav/about.md', createFileWithFrontmatter('nav/about.md', `---
label: About
collection: navigation
sortId: 1
---
`));
      files.set('posts/post.md', createFileWithFrontmatter('posts/post.md', `---
title: Post
---
`));

      const context = createTestContext();
      const plugin = collections({
        navigation: {
          sortBy: 'sortId',
        },
      });

      await plugin(files, context);

      const navCollection = (context.metadata.collections as Record<string, unknown[]>).navigation;
      expect(navCollection).toHaveLength(2);
      expect(navCollection[0]).toHaveProperty('label', 'Home');
      expect(navCollection[1]).toHaveProperty('label', 'About');
    });

    it('should support multiple collections per file', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('featured.md', createFileWithFrontmatter('featured.md', `---
title: Featured Post
collection:
  - posts
  - featured
date: 2024-01-01
---
`));

      const context = createTestContext();
      const plugin = collections({
        posts: {},
        featured: {},
      });

      await plugin(files, context);

      const postsCollection = (context.metadata.collections as Record<string, unknown[]>).posts;
      const featuredCollection = (context.metadata.collections as Record<string, unknown[]>).featured;

      expect(postsCollection).toHaveLength(1);
      expect(featuredCollection).toHaveLength(1);
    });
  });

  describe('sorting', () => {
    it('should sort by date ascending by default', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/old.md', createFileWithFrontmatter('posts/old.md', `---
title: Old Post
date: 2024-01-01
---
`));
      files.set('posts/new.md', createFileWithFrontmatter('posts/new.md', `---
title: New Post
date: 2024-03-01
---
`));
      files.set('posts/mid.md', createFileWithFrontmatter('posts/mid.md', `---
title: Mid Post
date: 2024-02-01
---
`));

      const context = createTestContext();
      const plugin = collections({
        posts: {
          pattern: 'posts/**/*.md',
          sortBy: 'date',
        },
      });

      await plugin(files, context);

      const postsCollection = (context.metadata.collections as Record<string, unknown[]>).posts;
      expect(postsCollection[0]).toHaveProperty('title', 'Old Post');
      expect(postsCollection[1]).toHaveProperty('title', 'Mid Post');
      expect(postsCollection[2]).toHaveProperty('title', 'New Post');
    });

    it('should sort by date descending with reverse: true', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/old.md', createFileWithFrontmatter('posts/old.md', `---
title: Old Post
date: 2024-01-01
---
`));
      files.set('posts/new.md', createFileWithFrontmatter('posts/new.md', `---
title: New Post
date: 2024-03-01
---
`));

      const context = createTestContext();
      const plugin = collections({
        posts: {
          pattern: 'posts/**/*.md',
          sortBy: 'date',
          reverse: true,
        },
      });

      await plugin(files, context);

      const postsCollection = (context.metadata.collections as Record<string, unknown[]>).posts;
      expect(postsCollection[0]).toHaveProperty('title', 'New Post');
      expect(postsCollection[1]).toHaveProperty('title', 'Old Post');
    });

    it('should sort by numeric field', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('nav/about.md', createFileWithFrontmatter('nav/about.md', `---
label: About
collection: navigation
sortId: 2
---
`));
      files.set('nav/home.md', createFileWithFrontmatter('nav/home.md', `---
label: Home
collection: navigation
sortId: 1
---
`));

      const context = createTestContext();
      const plugin = collections({
        navigation: {
          sortBy: 'sortId',
        },
      });

      await plugin(files, context);

      const navCollection = (context.metadata.collections as Record<string, unknown[]>).navigation;
      expect(navCollection[0]).toHaveProperty('label', 'Home');
      expect(navCollection[1]).toHaveProperty('label', 'About');
    });

    it('should sort by string field', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('a.md', createFileWithFrontmatter('a.md', `---
title: Zebra
collection: alphabetical
---
`));
      files.set('b.md', createFileWithFrontmatter('b.md', `---
title: Apple
collection: alphabetical
---
`));

      const context = createTestContext();
      const plugin = collections({
        alphabetical: {
          sortBy: 'title',
        },
      });

      await plugin(files, context);

      const collection = (context.metadata.collections as Record<string, unknown[]>).alphabetical;
      expect(collection[0]).toHaveProperty('title', 'Apple');
      expect(collection[1]).toHaveProperty('title', 'Zebra');
    });
  });

  describe('limits', () => {
    it('should limit collection size', async () => {
      const files = new Map<string, VirtualFile>();
      for (let i = 1; i <= 10; i++) {
        files.set(`posts/post-${i}.md`, createFileWithFrontmatter(`posts/post-${i}.md`, `---
title: Post ${i}
date: 2024-01-${String(i).padStart(2, '0')}
---
`));
      }

      const context = createTestContext();
      const plugin = collections({
        posts: {
          pattern: 'posts/**/*.md',
          sortBy: 'date',
          reverse: true,
          limit: 3,
        },
      });

      await plugin(files, context);

      const postsCollection = (context.metadata.collections as Record<string, unknown[]>).posts;
      expect(postsCollection).toHaveLength(3);
      // Should have newest posts due to reverse: true
      expect(postsCollection[0]).toHaveProperty('title', 'Post 10');
    });
  });

  describe('file metadata', () => {
    it('should add collection reference to files', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/post.md', createFileWithFrontmatter('posts/post.md', `---
title: Post
---
`));

      const context = createTestContext();
      const plugin = collections({
        posts: {
          pattern: 'posts/**/*.md',
        },
      });

      await plugin(files, context);

      const file = files.get('posts/post.md')!;
      expect(file.metadata.collection).toBe('posts');
      expect(file.metadata.collections).toContain('posts');
    });

    it('should not add reference when refer: false', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('nav/home.md', createFileWithFrontmatter('nav/home.md', `---
label: Home
collection: navigation
---
`));

      const context = createTestContext();
      const plugin = collections({
        navigation: {
          refer: false,
        },
      });

      await plugin(files, context);

      const file = files.get('nav/home.md')!;
      expect(file.metadata.collections).toBeUndefined();
    });
  });

  describe('collection items', () => {
    it('should include file path in collection items', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/my-post.md', createFileWithFrontmatter('posts/my-post.md', `---
title: My Post
---
`));

      const context = createTestContext();
      const plugin = collections({
        posts: {
          pattern: 'posts/**/*.md',
        },
      });

      await plugin(files, context);

      const postsCollection = (context.metadata.collections as Record<string, unknown[]>).posts;
      expect(postsCollection[0]).toHaveProperty('path', 'posts/my-post.md');
    });

    it('should include file contents for excerpt access', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/post.md', createFileWithFrontmatter('posts/post.md', `---
title: Post
---
This is the content.`));

      const context = createTestContext();
      const plugin = collections({
        posts: {
          pattern: 'posts/**/*.md',
        },
      });

      await plugin(files, context);

      const postsCollection = (context.metadata.collections as Record<string, unknown[]>).posts;
      expect(postsCollection[0]).toHaveProperty('contents');
      expect((postsCollection[0] as any).contents).toContain('This is the content.');
    });
  });

  describe('empty collections', () => {
    it('should create empty collection when no files match', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('pages/about.md', createFileWithFrontmatter('pages/about.md', `---
title: About
---
`));

      const context = createTestContext();
      const plugin = collections({
        posts: {
          pattern: 'posts/**/*.md',
        },
      });

      await plugin(files, context);

      const postsCollection = (context.metadata.collections as Record<string, unknown[]>).posts;
      expect(postsCollection).toEqual([]);
    });
  });

  describe('mixed pattern and metadata', () => {
    it('should not duplicate files that match both pattern and metadata', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/featured.md', createFileWithFrontmatter('posts/featured.md', `---
title: Featured Post
collection: posts
date: 2024-01-01
---
`));

      const context = createTestContext();
      const plugin = collections({
        posts: {
          pattern: 'posts/**/*.md',
        },
      });

      await plugin(files, context);

      const postsCollection = (context.metadata.collections as Record<string, unknown[]>).posts;
      expect(postsCollection).toHaveLength(1);
    });
  });
});
