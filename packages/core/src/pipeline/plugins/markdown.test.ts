/**
 * Tests for markdown plugin
 */
import { describe, it, expect, vi } from 'vitest';
import { markdown } from './markdown.js';
import type { VirtualFile, PipelineContext } from '../types.js';
import { createVirtualFile, getFileContents } from '../pipeline.js';

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

describe('Markdown Plugin', () => {
  describe('file processing', () => {
    it('should convert markdown files to HTML', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.md', createVirtualFile('post.md', '# Hello World'));

      const plugin = markdown();
      await plugin(files, createTestContext());

      expect(files.has('post.md')).toBe(false);
      expect(files.has('post.html')).toBe(true);

      const html = getFileContents(files.get('post.html')!);
      expect(html).toContain('<h1>Hello World</h1>');
    });

    it('should process .markdown extension', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.markdown', createVirtualFile('post.markdown', '# Test'));

      const plugin = markdown();
      await plugin(files, createTestContext());

      expect(files.has('post.html')).toBe(true);
    });

    it('should not process non-markdown files', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('script.js', createVirtualFile('script.js', 'const x = 1;'));

      const plugin = markdown();
      await plugin(files, createTestContext());

      expect(files.has('script.js')).toBe(true);
      expect(files.has('script.html')).toBe(false);
    });
  });

  describe('frontmatter extraction', () => {
    it('should extract frontmatter to metadata', async () => {
      const files = new Map<string, VirtualFile>();
      const content = `---
title: My Post
author: John
---
Content here`;
      files.set('post.md', createVirtualFile('post.md', content));

      const plugin = markdown();
      await plugin(files, createTestContext());

      const file = files.get('post.html')!;
      expect(file.metadata.title).toBe('My Post');
      expect(file.metadata.author).toBe('John');
    });

    it('should remove frontmatter from content', async () => {
      const files = new Map<string, VirtualFile>();
      const content = `---
title: Test
---
# Heading`;
      files.set('post.md', createVirtualFile('post.md', content));

      const plugin = markdown();
      await plugin(files, createTestContext());

      const html = getFileContents(files.get('post.html')!);
      expect(html).not.toContain('title: Test');
      expect(html).toContain('<h1>Heading</h1>');
    });

    it('should handle files without frontmatter', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.md', createVirtualFile('post.md', '# Just content'));

      const plugin = markdown();
      await plugin(files, createTestContext());

      const html = getFileContents(files.get('post.html')!);
      expect(html).toContain('<h1>Just content</h1>');
    });

    it('should skip frontmatter extraction when disabled', async () => {
      const files = new Map<string, VirtualFile>();
      const content = `---
title: Test
---
Content`;
      files.set('post.md', createVirtualFile('post.md', content));

      const plugin = markdown({ extractFrontmatter: false });
      await plugin(files, createTestContext());

      const file = files.get('post.html')!;
      expect(file.metadata.title).toBeUndefined();
    });
  });

  describe('custom patterns', () => {
    it('should process files matching custom pattern', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('docs/readme.txt', createVirtualFile('docs/readme.txt', '# Readme'));
      files.set('other.md', createVirtualFile('other.md', '# Other'));

      const plugin = markdown({ pattern: ['docs/*.txt'] });
      await plugin(files, createTestContext());

      expect(files.has('docs/readme.html')).toBe(true);
      expect(files.has('other.md')).toBe(true); // Not processed
    });
  });

  describe('output extension', () => {
    it('should use custom output extension', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.md', createVirtualFile('post.md', '# Test'));

      const plugin = markdown({ outputExtension: '.htm' });
      await plugin(files, createTestContext());

      expect(files.has('post.htm')).toBe(true);
      expect(files.has('post.html')).toBe(false);
    });
  });

  describe('markdown features', () => {
    it('should handle GFM tables', async () => {
      const files = new Map<string, VirtualFile>();
      const content = `
| Col A | Col B |
|-------|-------|
| 1     | 2     |`;
      files.set('post.md', createVirtualFile('post.md', content));

      const plugin = markdown();
      await plugin(files, createTestContext());

      const html = getFileContents(files.get('post.html')!);
      expect(html).toContain('<table>');
    });

    it('should handle code blocks', async () => {
      const files = new Map<string, VirtualFile>();
      const content = '```javascript\nconst x = 1;\n```';
      files.set('post.md', createVirtualFile('post.md', content));

      const plugin = markdown();
      await plugin(files, createTestContext());

      const html = getFileContents(files.get('post.html')!);
      expect(html).toContain('<code');
    });

    it('should handle inline HTML', async () => {
      const files = new Map<string, VirtualFile>();
      const content = '<div class="custom">content</div>';
      files.set('post.md', createVirtualFile('post.md', content));

      const plugin = markdown();
      await plugin(files, createTestContext());

      const html = getFileContents(files.get('post.html')!);
      expect(html).toContain('<div class="custom">content</div>');
    });
  });

  describe('metadata preservation', () => {
    it('should preserve existing metadata', async () => {
      const files = new Map<string, VirtualFile>();
      const file = createVirtualFile('post.md', '---\ntitle: New\n---\n# Test', {
        existingKey: 'value',
      });
      files.set('post.md', file);

      const plugin = markdown();
      await plugin(files, createTestContext());

      const processed = files.get('post.html')!;
      expect(processed.metadata.existingKey).toBe('value');
      expect(processed.metadata.title).toBe('New');
    });

    it('should frontmatter override existing metadata', async () => {
      const files = new Map<string, VirtualFile>();
      const file = createVirtualFile('post.md', '---\ntitle: New Title\n---\n# Test', {
        title: 'Old Title',
      });
      files.set('post.md', file);

      const plugin = markdown();
      await plugin(files, createTestContext());

      const processed = files.get('post.html')!;
      expect(processed.metadata.title).toBe('New Title');
    });
  });
});
