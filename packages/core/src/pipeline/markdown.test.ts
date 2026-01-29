/**
 * Tests for markdown processing
 */
import { describe, it, expect } from 'vitest';
import { processMarkdown, processMarkdownSync, createMarkdownProcessor } from './markdown.js';

describe('Markdown Processing', () => {
  describe('processMarkdown', () => {
    it('should convert simple markdown to HTML', async () => {
      const result = await processMarkdown('# Hello World');
      expect(result.html).toContain('<h1>Hello World</h1>');
      expect(result.messages).toEqual([]);
    });

    it('should handle paragraphs', async () => {
      const result = await processMarkdown('This is a paragraph.');
      expect(result.html).toContain('<p>This is a paragraph.</p>');
    });

    it('should handle emphasis and strong', async () => {
      const result = await processMarkdown('*italic* and **bold**');
      expect(result.html).toContain('<em>italic</em>');
      expect(result.html).toContain('<strong>bold</strong>');
    });

    it('should handle links', async () => {
      const result = await processMarkdown('[Link](https://example.com)');
      expect(result.html).toContain('<a href="https://example.com">Link</a>');
    });

    it('should handle code blocks', async () => {
      const result = await processMarkdown('```js\nconst x = 1;\n```');
      expect(result.html).toContain('<code');
      expect(result.html).toContain('const x = 1;');
    });

    it('should handle inline code', async () => {
      const result = await processMarkdown('Use `const` for constants');
      expect(result.html).toContain('<code>const</code>');
    });

    it('should handle lists', async () => {
      const result = await processMarkdown('- Item 1\n- Item 2');
      expect(result.html).toContain('<ul>');
      expect(result.html).toContain('<li>Item 1</li>');
      expect(result.html).toContain('<li>Item 2</li>');
    });

    it('should handle numbered lists', async () => {
      const result = await processMarkdown('1. First\n2. Second');
      expect(result.html).toContain('<ol>');
      expect(result.html).toContain('<li>First</li>');
      expect(result.html).toContain('<li>Second</li>');
    });
  });

  describe('GFM support', () => {
    it('should handle tables with gfm enabled (default)', async () => {
      const markdown = `
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
`;
      const result = await processMarkdown(markdown);
      expect(result.html).toContain('<table>');
      expect(result.html).toContain('<th>Header 1</th>');
      expect(result.html).toContain('<td>Cell 1</td>');
    });

    it('should handle strikethrough with gfm enabled', async () => {
      const result = await processMarkdown('~~deleted~~');
      expect(result.html).toContain('<del>deleted</del>');
    });

    it('should handle task lists with gfm enabled', async () => {
      const result = await processMarkdown('- [x] Done\n- [ ] Todo');
      expect(result.html).toContain('type="checkbox"');
    });

    it('should not parse tables when gfm disabled', async () => {
      const markdown = `
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
`;
      const result = await processMarkdown(markdown, { gfm: false });
      expect(result.html).not.toContain('<table>');
    });
  });

  describe('HTML handling', () => {
    it('should allow raw HTML by default', async () => {
      const result = await processMarkdown('<div class="custom">Content</div>');
      expect(result.html).toContain('<div class="custom">Content</div>');
    });

    it('should strip HTML when allowHtml is false', async () => {
      const result = await processMarkdown('<div class="custom">Content</div>', { allowHtml: false });
      expect(result.html).not.toContain('<div class="custom">');
    });
  });

  describe('Frontmatter handling', () => {
    it('should remove YAML frontmatter from output', async () => {
      const markdown = `---
title: Test
---
Content here`;
      const result = await processMarkdown(markdown);
      expect(result.html).not.toContain('title:');
      expect(result.html).toContain('Content here');
    });
  });

  describe('processMarkdownSync', () => {
    it('should convert markdown synchronously', () => {
      const result = processMarkdownSync('# Sync Test');
      expect(result.html).toContain('<h1>Sync Test</h1>');
    });
  });

  describe('createMarkdownProcessor', () => {
    it('should create a reusable processor', async () => {
      const processor = createMarkdownProcessor();
      const result1 = await processor.process('# Test 1');
      const result2 = await processor.process('# Test 2');

      expect(String(result1)).toContain('<h1>Test 1</h1>');
      expect(String(result2)).toContain('<h1>Test 2</h1>');
    });
  });
});
