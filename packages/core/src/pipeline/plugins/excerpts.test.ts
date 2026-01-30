/**
 * Tests for excerpts plugin
 */
import { describe, it, expect } from 'vitest';
import { excerpts } from './excerpts.js';
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

describe('excerpts plugin', () => {
  describe('basic extraction', () => {
    it('should extract content before <!-- more --> marker', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `<p>This is the excerpt.</p>
<!-- more -->
<p>This is the rest of the content.</p>`));

      const context = createTestContext();
      const plugin = excerpts();

      await plugin(files, context);

      const file = files.get('post.html')!;
      expect(file.metadata.excerpt).toBe('<p>This is the excerpt.</p>');
    });

    it('should store excerpt in specified key', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `Summary here.
<!-- more -->
Rest of content.`));

      const context = createTestContext();
      const plugin = excerpts({ key: 'summary' });

      await plugin(files, context);

      const file = files.get('post.html')!;
      expect(file.metadata.summary).toBe('Summary here.');
      expect(file.metadata.excerpt).toBeUndefined();
    });

    it('should remove marker from content by default', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `Excerpt.
<!-- more -->
Content.`));

      const context = createTestContext();
      const plugin = excerpts();

      await plugin(files, context);

      const content = getFileContents(files.get('post.html')!);
      expect(content).not.toContain('<!-- more -->');
      expect(content).toContain('Excerpt.');
      expect(content).toContain('Content.');
    });

    it('should preserve marker when removeMarker is false', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `Excerpt.
<!-- more -->
Content.`));

      const context = createTestContext();
      const plugin = excerpts({ removeMarker: false });

      await plugin(files, context);

      const content = getFileContents(files.get('post.html')!);
      expect(content).toContain('<!-- more -->');
    });
  });

  describe('custom markers', () => {
    it('should support custom marker', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `Excerpt content.
<!--excerpt-->
Full content.`));

      const context = createTestContext();
      const plugin = excerpts({ marker: '<!--excerpt-->' });

      await plugin(files, context);

      const file = files.get('post.html')!;
      expect(file.metadata.excerpt).toBe('Excerpt content.');
    });

    it('should support readmore style marker', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `Summary.
<!--readmore-->
Full post.`));

      const context = createTestContext();
      const plugin = excerpts({ marker: '<!--readmore-->' });

      await plugin(files, context);

      const file = files.get('post.html')!;
      expect(file.metadata.excerpt).toBe('Summary.');
    });
  });

  describe('pattern matching', () => {
    it('should only process matching files', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/post.html', createVirtualFile('posts/post.html', `Excerpt.
<!-- more -->
Content.`));
      files.set('pages/about.html', createVirtualFile('pages/about.html', `About.
<!-- more -->
More about.`));

      const context = createTestContext();
      const plugin = excerpts({ pattern: ['posts/**/*.html'] });

      await plugin(files, context);

      expect(files.get('posts/post.html')!.metadata.excerpt).toBe('Excerpt.');
      expect(files.get('pages/about.html')!.metadata.excerpt).toBeUndefined();
    });

    it('should match multiple patterns', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('posts/post.html', createVirtualFile('posts/post.html', `Post excerpt.
<!-- more -->
Content.`));
      files.set('articles/article.html', createVirtualFile('articles/article.html', `Article excerpt.
<!-- more -->
Content.`));

      const context = createTestContext();
      const plugin = excerpts({ pattern: ['posts/**/*.html', 'articles/**/*.html'] });

      await plugin(files, context);

      expect(files.get('posts/post.html')!.metadata.excerpt).toBe('Post excerpt.');
      expect(files.get('articles/article.html')!.metadata.excerpt).toBe('Article excerpt.');
    });
  });

  describe('no marker', () => {
    it('should skip files without marker', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `<p>Just content, no excerpt marker.</p>`));

      const context = createTestContext();
      const plugin = excerpts();

      await plugin(files, context);

      const file = files.get('post.html')!;
      expect(file.metadata.excerpt).toBeUndefined();
    });

    it('should not modify content without marker', async () => {
      const originalContent = '<p>Just content.</p>';
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', originalContent));

      const context = createTestContext();
      const plugin = excerpts();

      await plugin(files, context);

      const content = getFileContents(files.get('post.html')!);
      expect(content).toBe(originalContent);
    });
  });

  describe('trimming', () => {
    it('should trim excerpt by default', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `
  Excerpt with whitespace.
<!-- more -->
Content.`));

      const context = createTestContext();
      const plugin = excerpts();

      await plugin(files, context);

      const file = files.get('post.html')!;
      expect(file.metadata.excerpt).toBe('Excerpt with whitespace.');
    });

    it('should preserve whitespace when trim is false', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `  Excerpt
<!-- more -->
Content.`));

      const context = createTestContext();
      const plugin = excerpts({ trim: false });

      await plugin(files, context);

      const file = files.get('post.html')!;
      // Preserves leading spaces and trailing newline before marker
      expect(file.metadata.excerpt).toBe('  Excerpt\n');
    });
  });

  describe('HTML content', () => {
    it('should preserve HTML in excerpt', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `<p>This is <strong>important</strong> content.</p>
<p>Second paragraph.</p>
<!-- more -->
<p>Rest of the article.</p>`));

      const context = createTestContext();
      const plugin = excerpts();

      await plugin(files, context);

      const file = files.get('post.html')!;
      expect(file.metadata.excerpt).toContain('<strong>important</strong>');
      expect(file.metadata.excerpt).toContain('<p>Second paragraph.</p>');
    });

    it('should handle multiline HTML before marker', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `<article>
  <h1>Title</h1>
  <p>First paragraph.</p>
</article>
<!-- more -->
<section>More content</section>`));

      const context = createTestContext();
      const plugin = excerpts();

      await plugin(files, context);

      const file = files.get('post.html')!;
      expect(file.metadata.excerpt).toContain('<h1>Title</h1>');
      expect(file.metadata.excerpt).toContain('<p>First paragraph.</p>');
    });
  });

  describe('edge cases', () => {
    it('should handle marker at start of file', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `<!-- more -->
Content after marker.`));

      const context = createTestContext();
      const plugin = excerpts();

      await plugin(files, context);

      const file = files.get('post.html')!;
      expect(file.metadata.excerpt).toBe('');
    });

    it('should handle marker at end of file', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `All content is excerpt.
<!-- more -->`));

      const context = createTestContext();
      const plugin = excerpts();

      await plugin(files, context);

      const file = files.get('post.html')!;
      expect(file.metadata.excerpt).toBe('All content is excerpt.');
    });

    it('should only use first marker if multiple exist', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('post.html', createVirtualFile('post.html', `First excerpt.
<!-- more -->
Middle content.
<!-- more -->
End content.`));

      const context = createTestContext();
      const plugin = excerpts();

      await plugin(files, context);

      const file = files.get('post.html')!;
      expect(file.metadata.excerpt).toBe('First excerpt.');
      // Second marker should remain in content
      const content = getFileContents(files.get('post.html')!);
      expect(content).toContain('<!-- more -->');
    });
  });
});
