import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  stringifyFrontmatter,
  applyFrontmatter,
} from './frontmatter.js';
import { FrontmatterError } from './errors.js';

describe('parseFrontmatter', () => {
  it('should parse simple key-value pairs', () => {
    const content = `---
title: Hello World
description: A test post
---

Content here`;

    const result = parseFrontmatter(content);

    expect(result.hasFrontmatter).toBe(true);
    expect(result.metadata.title).toBe('Hello World');
    expect(result.metadata.description).toBe('A test post');
    expect(result.content.trim()).toBe('Content here');
  });

  it('should parse quoted strings', () => {
    const content = `---
title: "Hello: World"
quote: 'Single quoted'
---

Content`;

    const result = parseFrontmatter(content);

    expect(result.metadata.title).toBe('Hello: World');
    expect(result.metadata.quote).toBe('Single quoted');
  });

  it('should parse arrays', () => {
    const content = `---
tags: [javascript, typescript, web]
---

Content`;

    const result = parseFrontmatter(content);

    expect(result.metadata.tags).toEqual(['javascript', 'typescript', 'web']);
  });

  it('should parse booleans', () => {
    const content = `---
draft: true
published: false
---

Content`;

    const result = parseFrontmatter(content);

    expect(result.metadata.draft).toBe(true);
    expect(result.metadata.published).toBe(false);
  });

  it('should parse numbers', () => {
    const content = `---
count: 42
price: 19.99
negative: -5
---

Content`;

    const result = parseFrontmatter(content);

    expect(result.metadata.count).toBe(42);
    expect(result.metadata.price).toBe(19.99);
    expect(result.metadata.negative).toBe(-5);
  });

  it('should parse dates', () => {
    const content = `---
date: 2024-01-15
---

Content`;

    const result = parseFrontmatter(content);

    expect(result.metadata.date).toBeInstanceOf(Date);
    expect((result.metadata.date as Date).toISOString()).toContain('2024-01-15');
  });

  it('should handle null values', () => {
    const content = `---
value: null
other: ~
---

Content`;

    const result = parseFrontmatter(content);

    expect(result.metadata.value).toBeNull();
    expect(result.metadata.other).toBeNull();
  });

  it('should handle content without frontmatter', () => {
    const content = 'Just some content without frontmatter';

    const result = parseFrontmatter(content);

    expect(result.hasFrontmatter).toBe(false);
    expect(result.metadata).toEqual({});
    expect(result.content).toBe(content);
  });

  it('should throw for unclosed frontmatter', () => {
    const content = `---
title: Test
content without closing delimiter`;

    expect(() => parseFrontmatter(content, 'test.md')).toThrow(FrontmatterError);
  });

  it('should handle empty frontmatter', () => {
    const content = `---
---

Content`;

    const result = parseFrontmatter(content);

    expect(result.hasFrontmatter).toBe(true);
    expect(result.metadata).toEqual({});
  });

  it('should skip comments', () => {
    const content = `---
# This is a comment
title: Test
# Another comment
---

Content`;

    const result = parseFrontmatter(content);

    expect(result.metadata.title).toBe('Test');
    expect(Object.keys(result.metadata)).toHaveLength(1);
  });
});

describe('stringifyFrontmatter', () => {
  it('should stringify simple values', () => {
    const metadata = {
      title: 'Hello World',
      count: 42,
      draft: true,
    };

    const result = stringifyFrontmatter(metadata);

    expect(result).toContain('title: Hello World');
    expect(result).toContain('count: 42');
    expect(result).toContain('draft: true');
  });

  it('should quote strings with special characters', () => {
    const metadata = {
      title: 'Hello: World',
    };

    const result = stringifyFrontmatter(metadata);

    expect(result).toContain('title: "Hello: World"');
  });

  it('should stringify arrays', () => {
    const metadata = {
      tags: ['a', 'b', 'c'],
    };

    const result = stringifyFrontmatter(metadata);

    expect(result).toContain('tags: [a, b, c]');
  });

  it('should stringify dates', () => {
    const metadata = {
      date: new Date('2024-01-15'),
    };

    const result = stringifyFrontmatter(metadata);

    expect(result).toContain('date: 2024-01-15');
  });

  it('should skip undefined values', () => {
    const metadata = {
      title: 'Test',
      missing: undefined,
    };

    const result = stringifyFrontmatter(metadata);

    expect(result).not.toContain('missing');
  });
});

describe('applyFrontmatter', () => {
  it('should prepend frontmatter to content', () => {
    const content = 'Hello World';
    const metadata = { title: 'Test' };

    const result = applyFrontmatter(content, metadata);

    expect(result).toBe(`---
title: Test
---

Hello World`);
  });
});
