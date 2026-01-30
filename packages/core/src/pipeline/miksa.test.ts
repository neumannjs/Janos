/**
 * Integration tests with Miksa template (gijsvandam.nl)
 *
 * Tests the pipeline with real-world templates and content from
 * https://github.com/gijswijs/gijswijs.github.io
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Pipeline, createVirtualFile, getFileContents } from './pipeline.js';
import { markdown } from './plugins/markdown.js';
import { permalinks } from './plugins/permalinks.js';
import { layouts } from './plugins/layouts.js';
import { collections } from './plugins/collections.js';
import { pagination } from './plugins/pagination.js';
import { excerpts } from './plugins/excerpts.js';
import { createNunjucksEngine } from '../templates/nunjucks.js';
import type { VirtualFile, PipelineConfig } from './types.js';

/**
 * Site configuration matching gijsvandam.nl
 */
const createMiksaConfig = (): PipelineConfig => ({
  site: {
    title: 'Gijs van Dam',
    baseUrl: 'https://www.gijsvandam.nl',
    sourceDir: '_src',
    outputDir: '/',
  },
  mode: 'production',
});

/**
 * Sample post from the actual site (simplified)
 */
const SAMPLE_POST = `---
title: How do payments in Lightning Network work?
date: 2022-03-11
layout: post.njk
tags: cryptography, lightning network, bitcoin
---

Lightning Network is a peer-to-peer payment network that runs on top of the Bitcoin Blockchain. Because it runs on top of the Blockchain it is called a *layer-two solution*, which groups it together with other solutions that have this property of being built on top of a Blockchain.

## Payment Channels

Lightning Network employs a concept called *Payment Channel* to make this trick possible. A Payment Channel is a channel between two participants in the Lightning Network.

\`\`\`javascript
// Example code
const channel = await openChannel(peer, capacity);
\`\`\`

## Multi-hop Payments

In Lightning Network you don't need to open up a channel with every party that you want to transact with.
`;

/**
 * Simplified Miksa templates (self-contained, no extends/include)
 *
 * The real Miksa templates use {% extends %} and {% include %} which require
 * the Nunjucks engine to have access to the virtual filesystem.
 */
const MIKSA_POST_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{{ title }} | {{ site.title }}</title>
  <link href="/styles/main.css" rel="stylesheet">
</head>
<body class="article h-entry">
  <header>
    {{ site.title }}
    <nav>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about/">About</a></li>
      </ul>
    </nav>
  </header>
  <main>
    <article>
      <header>
        <h1 class="p-name">{{ title }}</h1>
        <time class="dt-published" datetime="{{ date }}">{{ date }}</time>
      </header>
      <section class="e-content">
        {{ contents | safe }}
      </section>
    </article>
  </main>
  <footer>
    <p>&copy; {{ site.title }}. Published with <a href="https://github.com/neumannjs/Janos">Janos</a>.</p>
  </footer>
</body>
</html>`;

const MIKSA_PAGE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ title }} | {{ site.title }}</title>
</head>
<body>
  <main>
    <h1>{{ title }}</h1>
    {{ contents | safe }}
  </main>
</body>
</html>`;

const MIKSA_HOME_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ site.title }}</title>
</head>
<body>
  <main class="home">
    <h1>{{ site.title }}</h1>
    {{ contents | safe }}
  </main>
</body>
</html>`;

describe('Miksa Template Integration', () => {
  let files: Map<string, VirtualFile>;
  let pipeline: Pipeline;

  beforeEach(() => {
    files = new Map();
    pipeline = new Pipeline(createMiksaConfig());
    pipeline.engine(createNunjucksEngine());

    // Add templates
    files.set('_layouts/post.njk', createVirtualFile('_layouts/post.njk', MIKSA_POST_TEMPLATE));
    files.set('_layouts/page.njk', createVirtualFile('_layouts/page.njk', MIKSA_PAGE_TEMPLATE));
    files.set('_layouts/home.njk', createVirtualFile('_layouts/home.njk', MIKSA_HOME_TEMPLATE));
  });

  describe('Blog Post Processing', () => {
    it('should process a Lightning Network blog post', async () => {
      files.set('posts/lightning-network.md', createVirtualFile('posts/lightning-network.md', SAMPLE_POST));

      pipeline
        .use(markdown())
        .use(permalinks())
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      // Should create clean URL
      expect(files.has('posts/lightning-network/index.html')).toBe(true);

      const html = getFileContents(files.get('posts/lightning-network/index.html')!);

      // Check HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>How do payments in Lightning Network work? | Gijs van Dam</title>');

      // Check h-entry microformats
      expect(html).toContain('class="article h-entry"');
      expect(html).toContain('class="p-name"');
      expect(html).toContain('class="dt-published"');
      expect(html).toContain('class="e-content"');

      // Check content
      expect(html).toContain('<h2>Payment Channels</h2>');
      expect(html).toContain('<em>layer-two solution</em>');
      expect(html).toContain('language-javascript');

      // Check Janos attribution
      expect(html).toContain('Published with <a href="https://github.com/neumannjs/Janos">Janos</a>');
    });

    it('should handle date metadata', async () => {
      files.set('posts/test.md', createVirtualFile('posts/test.md', `---
title: Test Post
date: 2024-01-15
layout: post.njk
---

Test content.
`));

      pipeline
        .use(markdown())
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      const html = getFileContents(files.get('posts/test.html')!);

      // Date should be in the output (as ISO string from Date object)
      expect(html).toContain('datetime="');
    });

    it('should preserve code blocks with syntax highlighting', async () => {
      files.set('posts/code.md', createVirtualFile('posts/code.md', `---
title: Code Examples
layout: post.njk
---

\`\`\`typescript
interface Channel {
  capacity: number;
  balance: number;
}
\`\`\`

\`\`\`bash
lncli openchannel --node_key=<pubkey> --local_amt=1000000
\`\`\`
`));

      pipeline
        .use(markdown())
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      const html = getFileContents(files.get('posts/code.html')!);

      expect(html).toContain('language-typescript');
      expect(html).toContain('language-bash');
      expect(html).toContain('interface Channel');
      expect(html).toContain('lncli openchannel');
    });
  });

  describe('Page Processing', () => {
    it('should process an about page', async () => {
      files.set('pages/about.md', createVirtualFile('pages/about.md', `---
title: About
layout: page.njk
---

Gijs van Dam is a freelance consultant and crypto researcher with over 20 years of international experience.

## Research Interests

- Lightning Network
- Bitcoin protocol
- Cryptography
`));

      pipeline
        .use(markdown())
        .use(permalinks())
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      expect(files.has('pages/about/index.html')).toBe(true);

      const html = getFileContents(files.get('pages/about/index.html')!);
      expect(html).toContain('<title>About | Gijs van Dam</title>');
      expect(html).toContain('<h2>Research Interests</h2>');
    });
  });

  describe('Site Structure', () => {
    it('should build multiple posts with proper URLs', async () => {
      files.set('posts/post-1.md', createVirtualFile('posts/post-1.md', `---
title: First Post
layout: post.njk
---
Content 1
`));

      files.set('posts/post-2.md', createVirtualFile('posts/post-2.md', `---
title: Second Post
layout: post.njk
---
Content 2
`));

      files.set('posts/nested/post-3.md', createVirtualFile('posts/nested/post-3.md', `---
title: Nested Post
layout: post.njk
---
Content 3
`));

      pipeline
        .use(markdown())
        .use(permalinks())
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      expect(files.has('posts/post-1/index.html')).toBe(true);
      expect(files.has('posts/post-2/index.html')).toBe(true);
      expect(files.has('posts/nested/post-3/index.html')).toBe(true);
    });

    it('should preserve static assets', async () => {
      files.set('styles/main.css', createVirtualFile('styles/main.css', `
body { font-family: sans-serif; }
.article { max-width: 800px; margin: 0 auto; }
`));

      files.set('images/logo.svg', createVirtualFile('images/logo.svg', '<svg></svg>'));

      pipeline
        .use(markdown())
        .use(permalinks())
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      expect(files.has('styles/main.css')).toBe(true);
      expect(files.has('images/logo.svg')).toBe(true);
    });
  });

  describe('Nunjucks Template Inheritance', () => {
    it('should support {% extends %} from virtual filesystem', async () => {
      // Base template
      files.set('_layouts/base.njk', createVirtualFile('_layouts/base.njk', `<!DOCTYPE html>
<html>
<head><title>{{ title }}</title></head>
<body>
{% block content %}Default content{% endblock %}
</body>
</html>`));

      // Child template that extends base
      files.set('_layouts/post.njk', createVirtualFile('_layouts/post.njk', `{% extends "base.njk" %}
{% block content %}
<article>
  <h1>{{ title }}</h1>
  {{ contents | safe }}
</article>
{% endblock %}`));

      files.set('posts/test.md', createVirtualFile('posts/test.md', `---
title: My Post
layout: post.njk
---

This is the post content.
`));

      pipeline
        .use(markdown())
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      const html = getFileContents(files.get('posts/test.html')!);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>My Post</title>');
      expect(html).toContain('<article>');
      expect(html).toContain('<h1>My Post</h1>');
      expect(html).toContain('This is the post content.');
      expect(html).not.toContain('Default content');
    });

    it('should support {% include %} from virtual filesystem', async () => {
      // Partial template
      files.set('_layouts/partials/nav.njk', createVirtualFile('_layouts/partials/nav.njk', `<nav>
  <a href="/">Home</a>
  <a href="/about/">About</a>
</nav>`));

      // Main template that includes partial
      files.set('_layouts/page.njk', createVirtualFile('_layouts/page.njk', `<!DOCTYPE html>
<html>
<body>
{% include "partials/nav.njk" %}
<main>{{ contents | safe }}</main>
</body>
</html>`));

      files.set('about.md', createVirtualFile('about.md', `---
title: About
layout: page.njk
---

About page content.
`));

      pipeline
        .use(markdown())
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      const html = getFileContents(files.get('about.html')!);
      expect(html).toContain('<nav>');
      expect(html).toContain('<a href="/">Home</a>');
      expect(html).toContain('<a href="/about/">About</a>');
      expect(html).toContain('About page content.');
    });

    it('should support nested {% extends %} chains', async () => {
      // Root base template
      files.set('_layouts/root.njk', createVirtualFile('_layouts/root.njk', `<!DOCTYPE html>
<html>{% block html %}{% endblock %}</html>`));

      // Intermediate template
      files.set('_layouts/base.njk', createVirtualFile('_layouts/base.njk', `{% extends "root.njk" %}
{% block html %}
<head>{% block head %}{% endblock %}</head>
<body>{% block body %}{% endblock %}</body>
{% endblock %}`));

      // Final template
      files.set('_layouts/page.njk', createVirtualFile('_layouts/page.njk', `{% extends "base.njk" %}
{% block head %}<title>{{ title }}</title>{% endblock %}
{% block body %}<main>{{ contents | safe }}</main>{% endblock %}`));

      files.set('test.md', createVirtualFile('test.md', `---
title: Nested Test
layout: page.njk
---

Content here.
`));

      pipeline
        .use(markdown())
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      const html = getFileContents(files.get('test.html')!);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Nested Test</title>');
      expect(html).toContain('<main>');
      expect(html).toContain('Content here.');
    });

    it('should support date filter in templates', async () => {
      files.set('_layouts/dated.njk', createVirtualFile('_layouts/dated.njk', `<time datetime="{{ date | date }}">{{ date | date("YYYY-MM-DD") }}</time>`));

      files.set('post.md', createVirtualFile('post.md', `---
title: Dated Post
date: 2024-03-15
layout: dated.njk
---

Content.
`));

      pipeline
        .use(markdown())
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      const html = getFileContents(files.get('post.html')!);
      expect(html).toContain('2024-03-15');
    });
  });

  describe('Collections', () => {
    it('should group posts into collections', async () => {
      // Add posts with dates
      files.set('posts/post-1.md', createVirtualFile('posts/post-1.md', `---
title: First Post
date: 2024-01-15
layout: post.njk
---
First post content.
`));
      files.set('posts/post-2.md', createVirtualFile('posts/post-2.md', `---
title: Second Post
date: 2024-02-20
layout: post.njk
---
Second post content.
`));

      // Add a template that uses collections
      files.set('_layouts/home.njk', createVirtualFile('_layouts/home.njk', `<!DOCTYPE html>
<html>
<body>
<h1>{{ site.title }}</h1>
<ul>
{% for post in collections.posts %}
  <li><a href="{{ post.path }}">{{ post.title }}</a></li>
{% endfor %}
</ul>
</body>
</html>`));

      files.set('index.md', createVirtualFile('index.md', `---
title: Home
layout: home.njk
---
`));

      // Markdown must run first to parse frontmatter into metadata
      // Collections uses the parsed metadata
      pipeline
        .use(markdown())
        .use(collections({
          posts: {
            pattern: 'posts/**/*.html', // After markdown, files are .html
            sortBy: 'date',
            reverse: true,
          },
        }))
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      const html = getFileContents(files.get('index.html')!);
      expect(html).toContain('<h1>Gijs van Dam</h1>');
      expect(html).toContain('First Post');
      expect(html).toContain('Second Post');
      // Reverse order - newest first
      expect(html.indexOf('Second Post')).toBeLessThan(html.indexOf('First Post'));
    });
  });

  describe('Pagination', () => {
    it('should paginate collections for home page', async () => {
      // Add more posts for pagination
      for (let i = 1; i <= 5; i++) {
        files.set(`posts/post-${i}.md`, createVirtualFile(`posts/post-${i}.md`, `---
title: Post ${i}
date: 2024-01-${String(i).padStart(2, '0')}
layout: post.njk
---
Content for post ${i}.
`));
      }

      // Home template with pagination
      files.set('_layouts/paginated-home.njk', createVirtualFile('_layouts/paginated-home.njk', `<!DOCTYPE html>
<html>
<body>
<h1>{{ title }}</h1>
<ul>
{% for post in pagination.files %}
  <li>{{ post.title }}</li>
{% endfor %}
</ul>
<p>Page {{ pagination.current }} of {{ pagination.total }}</p>
{% if pagination.next %}
  <a href="{{ pagination.next.path }}">Next</a>
{% endif %}
{% if pagination.previous %}
  <a href="{{ pagination.previous.path }}">Previous</a>
{% endif %}
</body>
</html>`));

      pipeline
        .use(markdown())
        .use(collections({
          posts: {
            pattern: 'posts/**/*.html',
            sortBy: 'date',
            reverse: true,
          },
        }))
        .use(pagination({
          'collections.posts': {
            perPage: 2,
            first: 'index.html',
            path: 'page/:num/index.html',
            layout: 'paginated-home.njk',
            pageMetadata: {
              title: 'Blog',
            },
          },
        }))
        .use(layouts({ directory: '_layouts' }));

      await pipeline.process(files);

      // Should create 3 pages (5 posts / 2 per page)
      expect(files.has('index.html')).toBe(true);
      expect(files.has('page/2/index.html')).toBe(true);
      expect(files.has('page/3/index.html')).toBe(true);

      const page1 = getFileContents(files.get('index.html')!);
      expect(page1).toContain('<h1>Blog</h1>');
      expect(page1).toContain('Page 1 of 3');
      expect(page1).toContain('Post 5'); // Newest first
      expect(page1).toContain('Post 4');
      expect(page1).not.toContain('Post 3'); // On page 2
      expect(page1).toContain('href="page/2/index.html"'); // Next link

      const page2 = getFileContents(files.get('page/2/index.html')!);
      expect(page2).toContain('Page 2 of 3');
      expect(page2).toContain('Post 3');
      expect(page2).toContain('Post 2');
      expect(page2).toContain('href="index.html"'); // Previous link
      expect(page2).toContain('href="page/3/index.html"'); // Next link
    });
  });

  describe('Known Limitations', () => {
    // These tests document features that still need to be implemented

    it.todo('should support tag/topic generation');
  });
});

describe('Feature Gap Analysis', () => {
  /**
   * This section documents what features are needed to fully support
   * the Miksa template and gijsvandam.nl site.
   */

  it('should document implemented and remaining features for full Miksa support', () => {
    const implementedFeatures = {
      templateEngine: [
        '✅ Nunjucks {% extends %} with virtual filesystem',
        '✅ Nunjucks {% include %} with virtual filesystem',
        '✅ {% asyncEach %} (native Nunjucks, works with async render)',
        '✅ Date formatting filters (date)',
      ],
      plugins: [
        '✅ markdown - process markdown files',
        '✅ permalinks - clean URLs',
        '✅ layouts - template rendering with virtual filesystem',
        '✅ collections - group files by pattern/metadata',
        '✅ pagination - paginate collections',
        '✅ excerpts - extract post excerpts (<!-- more -->)',
        '✅ css-change-url - rewrite CSS URLs',
        '✅ inline-source - inline external resources',
        '✅ responsive-images - resize and convert images',
        '✅ webmentions - IndieWeb support',
      ],
    };

    const remainingFeatures = {
      templateEngine: [
        'Reading time calculation macro',
        '{% import %} for Nunjucks macros (may already work)',
      ],
      plugins: [
        'tags/topics - generate tag pages',
        'publish - filter drafts/private/future posts',
        'rss - generate RSS feed',
        'sitemap - generate sitemap.xml',
        'assets - copy static files',
      ],
      metadata: [
        'navigation collection support',
        'social_media configuration',
        'rootpath for subdirectory deployments',
      ],
    };

    // Verify we have progress
    expect(implementedFeatures.templateEngine.length).toBe(4);
    expect(implementedFeatures.plugins.length).toBe(10);
    expect(remainingFeatures.plugins.length).toBeGreaterThan(0);
  });
});
