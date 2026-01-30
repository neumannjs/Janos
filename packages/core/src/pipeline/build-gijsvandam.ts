/**
 * Build script for gijsvandam.nl
 *
 * This script builds the gijsvandam.nl site using the new Janos pipeline.
 * Run with: npx tsx src/pipeline/build-gijsvandam.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Pipeline, createVirtualFile } from './pipeline.js';
import { markdown } from './plugins/markdown.js';
import { collections } from './plugins/collections.js';
import { pagination } from './plugins/pagination.js';
import { excerpts } from './plugins/excerpts.js';
import { permalinks } from './plugins/permalinks.js';
import { layouts } from './plugins/layouts.js';
import { assets } from './plugins/assets.js';
import type { VirtualFile, VirtualFileMap } from './types.js';

const SITE_ROOT = '/home/gijs/git/gijswijs.github.io';
const OUTPUT_DIR = '/home/gijs/git/Janos/packages/core/test-output/gijsvandam';

/**
 * Recursively read all files from a directory
 */
function readDirRecursive(dir: string, baseDir: string = dir): Array<{ relativePath: string; absolutePath: string }> {
  const results: Array<{ relativePath: string; absolutePath: string }> = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, absolutePath);

    if (entry.isDirectory()) {
      // Skip hidden directories and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      results.push(...readDirRecursive(absolutePath, baseDir));
    } else {
      results.push({ relativePath, absolutePath });
    }
  }

  return results;
}

/**
 * Load files into virtual file map
 */
function loadFiles(rootDir: string, subDir: string): VirtualFileMap {
  const files: VirtualFileMap = new Map();
  const fullPath = path.join(rootDir, subDir);

  if (!fs.existsSync(fullPath)) {
    console.log(`Directory not found: ${fullPath}`);
    return files;
  }

  const entries = readDirRecursive(fullPath, rootDir);

  for (const { relativePath, absolutePath } of entries) {
    const contents = fs.readFileSync(absolutePath);
    const file: VirtualFile = {
      path: relativePath,
      contents: new Uint8Array(contents),
      metadata: {},
      sourcePath: relativePath,
    };
    files.set(relativePath, file);
  }

  return files;
}

/**
 * Write virtual files to disk
 */
function writeFiles(files: VirtualFileMap, outputDir: string): void {
  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [filePath, file] of files) {
    // Skip source files
    if (filePath.startsWith('_src/') || filePath.startsWith('_layouts/')) {
      continue;
    }

    const outputPath = path.join(outputDir, filePath);
    const dir = path.dirname(outputPath);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, file.contents);
  }
}

async function build() {
  console.log('Building gijsvandam.nl with Janos pipeline...\n');

  // Load source files
  console.log('Loading source files...');
  const files: VirtualFileMap = new Map();

  // Load _src directory
  const srcFiles = loadFiles(SITE_ROOT, '_src');
  for (const [path, file] of srcFiles) {
    files.set(path, file);
  }
  console.log(`  Loaded ${srcFiles.size} source files from _src/`);

  // Load _layouts directory
  const layoutFiles = loadFiles(SITE_ROOT, '_layouts');
  for (const [path, file] of layoutFiles) {
    files.set(path, file);
  }
  console.log(`  Loaded ${layoutFiles.size} layout files from _layouts/`);

  // Load metalsmith.json for metadata
  const metalsmithConfig = JSON.parse(
    fs.readFileSync(path.join(SITE_ROOT, '_layouts/metalsmith.json'), 'utf-8')
  );

  // Create pipeline
  const pipeline = new Pipeline({
    site: {
      title: metalsmithConfig.metadata.site_title,
      baseUrl: 'https://www.gijsvandam.nl',
      sourceDir: '_src',
      outputDir: '/',
    },
    mode: 'development',
  });

  // Add global metadata from metalsmith.json
  for (const [key, value] of Object.entries(metalsmithConfig.metadata)) {
    pipeline.metadata(key, value);
  }
  pipeline.metadata('rootpath', '/');

  // Add plugins
  pipeline
    // Process markdown files
    .use(markdown())

    // Extract excerpts
    .use(excerpts({ marker: '<!-- more -->' }))

    // Create collections
    .use(collections({
      posts: {
        pattern: '_src/posts/**/*.html',
        sortBy: 'date',
        reverse: true,
      },
      stream: {
        pattern: ['_src/stream/**/*.html', '_src/posts/**/*.html'],
        sortBy: 'date',
        reverse: true,
      },
      navigation: {
        // Pages with collection: navigation in frontmatter are auto-added
        // Pattern catches nav folder items (like home.md)
        pattern: '_src/nav/**/*.html',
        sortBy: 'sortId',
      },
      // Stream item types - matched by metadata in frontmatter
      event: { sortBy: 'date', reverse: true },
      rsvp: { sortBy: 'date', reverse: true },
      repost: { sortBy: 'date', reverse: true },
      like: { sortBy: 'date', reverse: true },
      reply: { sortBy: 'date', reverse: true },
      video: { sortBy: 'date', reverse: true },
      photo: { sortBy: 'date', reverse: true },
      note: { sortBy: 'date', reverse: true },
      article: { sortBy: 'date', reverse: true },
    }))

    // Paginate collections
    .use(pagination({
      'collections.posts': {
        perPage: 6,
        layout: 'miksa/home.njk',
        first: 'index.html',
        path: 'posts/:num/index.html',
        pageMetadata: {
          title: 'Archive',
          feature_image: '/images/cover.jpg',
        },
      },
      'collections.stream': {
        perPage: 25,
        layout: 'miksa/stream.njk',
        first: 'feed/index.html',
        path: 'feed/:num/index.html',
        pageMetadata: {
          title: 'Feed',
        },
      },
    }))

    // Generate permalinks
    .use(permalinks({
      match: ['**/*.html'],
      linksets: [
        { match: { collection: 'posts' }, pattern: 'post/:title' },
        { match: { collection: 'navigation' }, pattern: ':label' },
        { match: { collection: 'event' }, pattern: 'event/:date-:slug' },
        { match: { collection: 'rsvp' }, pattern: 'rsvp/:date-:slug' },
        { match: { collection: 'repost' }, pattern: 'repost/:date-:slug' },
        { match: { collection: 'like' }, pattern: 'like/:date-:slug' },
        { match: { collection: 'reply' }, pattern: 'reply/:date-:slug' },
        { match: { collection: 'video' }, pattern: 'video/:date-:slug' },
        { match: { collection: 'photo' }, pattern: 'photo/:date-:slug' },
        { match: { collection: 'note' }, pattern: 'note/:date-:slug' },
        { match: { collection: 'article' }, pattern: 'article/:date-:slug' },
      ],
    }))

    // Update collection items with permalinked paths
    .use((files, context) => {
      // Build a map of pre-permalink path -> post-permalink path
      // Collection items have .html paths (after markdown), we need to map those to final paths
      const pathMap = new Map<string, string>();

      for (const [newPath, file] of files) {
        // Map sourcePath (original .md) to new path
        if (file.sourcePath) {
          pathMap.set(file.sourcePath, newPath);
          // Also map the .html version of sourcePath (what collections use)
          const sourceAsHtml = file.sourcePath.replace(/\.md$/, '.html');
          pathMap.set(sourceAsHtml, newPath);
        }
      }

      // Update collection items
      for (const [collectionName, items] of Object.entries(context.metadata.collections)) {
        if (Array.isArray(items)) {
          for (const item of items as Array<{ path?: string; sourcePath?: string; permalink?: string; navpath?: string }>) {
            // For navigation items with navpath, use that directly
            if (item.navpath) {
              item.path = item.navpath;
              continue;
            }

            // Try to find the new path
            const originalPath = item.path;
            if (originalPath && pathMap.has(originalPath)) {
              const newPath = pathMap.get(originalPath)!;
              item.path = newPath;
              // Set permalink without index.html
              item.permalink = '/' + newPath.replace(/\/index\.html$/, '/').replace(/\.html$/, '/');
            }
          }
        }
      }

      // Expose collections directly in context for templates
      // (templates use `navigation` not `collections.navigation`)
      for (const [name, items] of Object.entries(context.metadata.collections)) {
        context.metadata[name] = items;
      }

      context.log('collections: updated paths after permalinks', 'debug');
    })

    // Apply layouts
    .use(layouts({
      directory: '_layouts',
      pattern: ['**/*.html'],
      default: 'miksa/post.njk',
    }))

    // Copy assets
    .use(assets({
      sources: [
        { source: '_layouts/miksa/assets', destination: '/' },
        { source: '_src/images', destination: '/images' },
      ],
    }));

  // Run the pipeline
  console.log('\nRunning pipeline...');
  const startTime = Date.now();

  try {
    const result = await pipeline.process(files);
    const duration = Date.now() - startTime;

    console.log(`\nPipeline completed in ${duration}ms`);
    console.log(`Total files: ${result.size}`);

    // Count file types
    const counts: Record<string, number> = {};
    for (const [filePath] of result) {
      const ext = path.extname(filePath) || '(no ext)';
      counts[ext] = (counts[ext] || 0) + 1;
    }
    console.log('\nFile types:');
    for (const [ext, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${ext}: ${count}`);
    }

    // Write output
    console.log(`\nWriting output to ${OUTPUT_DIR}...`);
    writeFiles(result, OUTPUT_DIR);

    // Count output files
    let outputCount = 0;
    for (const [filePath] of result) {
      if (!filePath.startsWith('_src/') && !filePath.startsWith('_layouts/')) {
        outputCount++;
      }
    }
    console.log(`Wrote ${outputCount} files`);

    // Show some sample output files
    console.log('\nSample output files:');
    let shown = 0;
    for (const [filePath] of result) {
      if (!filePath.startsWith('_src/') && !filePath.startsWith('_layouts/') && filePath.endsWith('.html')) {
        console.log(`  ${filePath}`);
        if (++shown >= 10) break;
      }
    }

  } catch (error) {
    console.error('\nBuild failed:', error);
    process.exit(1);
  }
}

build();
