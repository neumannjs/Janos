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

  describe('Known Limitations', () => {
    // These tests document features that need to be implemented

    it.todo('should support Nunjucks {% extends %} from virtual filesystem');
    it.todo('should support Nunjucks {% include %} from virtual filesystem');
    it.todo('should support {% asyncEach %} for async iteration');
    it.todo('should support date filters like | date("YYYY")');
    it.todo('should support collections plugin for grouping content');
    it.todo('should support pagination plugin');
    it.todo('should support tag/topic generation');
  });
});

describe('Feature Gap Analysis', () => {
  /**
   * This section documents what features are needed to fully support
   * the Miksa template and gijsvandam.nl site.
   */

  it('should document required features for full Miksa support', () => {
    const requiredFeatures = {
      // Template Engine Enhancements
      templateEngine: [
        'Nunjucks {% extends %} with virtual filesystem',
        'Nunjucks {% include %} with virtual filesystem',
        'Custom async iteration tag (asyncEach)',
        'Date formatting filters (date, moment)',
        'Reading time calculation macro',
      ],

      // Pipeline Plugins Needed
      plugins: [
        'collections - group files by pattern/metadata',
        'pagination - paginate collections',
        'tags/topics - generate tag pages',
        'publish - filter drafts/private/future posts',
        'excerpts - extract post excerpts',
        'rss - generate RSS feed',
        'sitemap - generate sitemap.xml',
      ],

      // Metadata/Config
      metadata: [
        'navigation collection',
        'social_media configuration',
        'rootpath for subdirectory deployments',
      ],
    };

    // This test just documents the requirements
    expect(requiredFeatures.templateEngine.length).toBeGreaterThan(0);
    expect(requiredFeatures.plugins.length).toBeGreaterThan(0);
  });
});
