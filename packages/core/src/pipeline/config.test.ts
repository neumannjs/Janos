/**
 * Tests for JSON configuration loader
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseConfig,
  validateConfig,
  createPipelineFromConfig,
  loadConfig,
  registerPlugin,
  unregisterPlugin,
  listPlugins,
  hasPlugin,
  getConfigSchema,
  janosConfigSchema,
  type JsonConfig,
} from './config.js';
import type { VirtualFileMap, PipelineContext } from './types.js';

describe('Config Validation', () => {
  it('should reject non-object config', () => {
    expect(() => validateConfig(null)).toThrow('Config must be an object');
    expect(() => validateConfig('string')).toThrow('Config must be an object');
    expect(() => validateConfig(123)).toThrow('Config must be an object');
  });

  it('should require site section', () => {
    expect(() => validateConfig({})).toThrow('Config must have a "site" section');
    expect(() => validateConfig({ site: null })).toThrow('Config must have a "site" section');
  });

  it('should require site.title', () => {
    expect(() => validateConfig({ site: {} })).toThrow('site.title is required');
    expect(() => validateConfig({ site: { title: 123 } })).toThrow('site.title is required');
  });

  it('should require site.baseUrl', () => {
    expect(() => validateConfig({ site: { title: 'Test' } })).toThrow('site.baseUrl is required');
  });

  it('should require pipeline array', () => {
    expect(() => validateConfig({
      site: { title: 'Test', baseUrl: 'https://example.com' }
    })).toThrow('Config must have a "pipeline" array');

    expect(() => validateConfig({
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: 'not-an-array'
    })).toThrow('Config must have a "pipeline" array');
  });

  it('should validate pipeline entries', () => {
    expect(() => validateConfig({
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: [123]
    })).toThrow('pipeline[0] must be a string or object');
  });

  it('should accept valid config', () => {
    const config = {
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: ['markdown', { layouts: { default: 'post.njk' } }]
    };

    expect(() => validateConfig(config)).not.toThrow();
  });
});

describe('Config Parsing', () => {
  it('should parse valid JSON', () => {
    const json = JSON.stringify({
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: ['markdown']
    });

    const config = parseConfig(json);
    expect(config.site.title).toBe('Test');
    expect(config.pipeline).toEqual(['markdown']);
  });

  it('should reject invalid JSON', () => {
    expect(() => parseConfig('not json')).toThrow('Invalid JSON');
  });

  it('should reject valid JSON with invalid structure', () => {
    expect(() => parseConfig('{}')).toThrow('Config must have a "site" section');
  });
});

describe('Pipeline Creation', () => {
  it('should create pipeline with minimal config', () => {
    const config: JsonConfig = {
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: []
    };

    const pipeline = createPipelineFromConfig(config);
    expect(pipeline).toBeDefined();
    expect(pipeline.getContext().config.title).toBe('Test');
  });

  it('should apply default sourceDir and outputDir', () => {
    const config: JsonConfig = {
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: []
    };

    const pipeline = createPipelineFromConfig(config);
    expect(pipeline.getContext().config.sourceDir).toBe('_src');
    expect(pipeline.getContext().config.outputDir).toBe('/');
  });

  it('should apply custom metadata', () => {
    const config: JsonConfig = {
      site: { title: 'Test', baseUrl: 'https://example.com' },
      metadata: {
        author: 'John Doe',
        customKey: { nested: 'value' }
      },
      pipeline: []
    };

    const pipeline = createPipelineFromConfig(config);
    const context = pipeline.getContext();
    expect(context.metadata.author).toBe('John Doe');
    expect(context.metadata.customKey).toEqual({ nested: 'value' });
  });

  it('should add plugins from string config', () => {
    const config: JsonConfig = {
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: ['markdown']
    };

    const pipeline = createPipelineFromConfig(config);
    // Pipeline was created without throwing
    expect(pipeline).toBeDefined();
  });

  it('should add plugins from object config', () => {
    const config: JsonConfig = {
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: [
        { excerpts: { marker: '<!-- more -->' } },
        { layouts: { default: 'post.njk', directory: '_layouts' } }
      ]
    };

    const pipeline = createPipelineFromConfig(config);
    expect(pipeline).toBeDefined();
  });

  it('should reject unknown plugins', () => {
    const config: JsonConfig = {
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: ['unknown-plugin']
    };

    expect(() => createPipelineFromConfig(config)).toThrow('Unknown plugin: "unknown-plugin"');
  });

  it('should reject plugin config with multiple keys', () => {
    const config: JsonConfig = {
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: [
        { markdown: {}, layouts: {} } // Invalid: two keys
      ]
    };

    expect(() => createPipelineFromConfig(config)).toThrow('expected single key');
  });

  it('should handle author as string or object', () => {
    const stringAuthor: JsonConfig = {
      site: { title: 'Test', baseUrl: 'https://example.com', author: 'John Doe' },
      pipeline: []
    };

    const objectAuthor: JsonConfig = {
      site: { title: 'Test', baseUrl: 'https://example.com', author: { name: 'Jane Doe', email: 'jane@example.com' } },
      pipeline: []
    };

    const pipeline1 = createPipelineFromConfig(stringAuthor);
    expect(pipeline1.getContext().config.author).toEqual({ name: 'John Doe' });

    const pipeline2 = createPipelineFromConfig(objectAuthor);
    expect(pipeline2.getContext().config.author).toEqual({ name: 'Jane Doe', email: 'jane@example.com' });
  });

  it('should set build mode', () => {
    const devConfig: JsonConfig = {
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: [],
      mode: 'development'
    };

    const prodConfig: JsonConfig = {
      site: { title: 'Test', baseUrl: 'https://example.com' },
      pipeline: [],
      mode: 'production'
    };

    expect(createPipelineFromConfig(devConfig).getContext().mode).toBe('development');
    expect(createPipelineFromConfig(prodConfig).getContext().mode).toBe('production');
  });
});

describe('loadConfig', () => {
  it('should parse JSON and create pipeline in one call', () => {
    const json = JSON.stringify({
      site: { title: 'Test Site', baseUrl: 'https://example.com' },
      metadata: { rootpath: '/' },
      pipeline: ['markdown', { excerpts: { marker: '<!-- more -->' } }]
    });

    const pipeline = loadConfig(json);
    expect(pipeline.getContext().config.title).toBe('Test Site');
    expect(pipeline.getContext().metadata.rootpath).toBe('/');
  });
});

describe('Plugin Registry', () => {
  it('should list built-in plugins', () => {
    const plugins = listPlugins();

    expect(plugins).toContain('markdown');
    expect(plugins).toContain('layouts');
    expect(plugins).toContain('collections');
    expect(plugins).toContain('pagination');
    expect(plugins).toContain('permalinks');
    expect(plugins).toContain('excerpts');
    expect(plugins).toContain('assets');
  });

  it('should support alternative plugin names', () => {
    expect(hasPlugin('css-urls')).toBe(true);
    expect(hasPlugin('cssUrls')).toBe(true);
    expect(hasPlugin('responsive-images')).toBe(true);
    expect(hasPlugin('responsiveImages')).toBe(true);
  });

  it('should check plugin existence', () => {
    expect(hasPlugin('markdown')).toBe(true);
    expect(hasPlugin('nonexistent')).toBe(false);
  });

  describe('Custom Plugins', () => {
    const customPluginName = 'test-custom-plugin';

    afterEach(() => {
      unregisterPlugin(customPluginName);
    });

    it('should register custom plugins', () => {
      const customPlugin = () => async (files: VirtualFileMap, context: PipelineContext) => {
        context.log('Custom plugin ran');
      };

      registerPlugin(customPluginName, customPlugin);

      expect(hasPlugin(customPluginName)).toBe(true);
      expect(listPlugins()).toContain(customPluginName);
    });

    it('should use custom plugins in config', () => {
      let pluginRan = false;

      const customPlugin = () => async () => {
        pluginRan = true;
      };

      registerPlugin(customPluginName, customPlugin);

      const config: JsonConfig = {
        site: { title: 'Test', baseUrl: 'https://example.com' },
        pipeline: [customPluginName]
      };

      const pipeline = createPipelineFromConfig(config);
      expect(pipeline).toBeDefined();
    });

    it('should not allow overriding built-in plugins', () => {
      const fakeMarkdown = () => async () => {};

      expect(() => registerPlugin('markdown', fakeMarkdown)).toThrow('Cannot override built-in plugin');
    });

    it('should unregister custom plugins', () => {
      const customPlugin = () => async () => {};

      registerPlugin(customPluginName, customPlugin);
      expect(hasPlugin(customPluginName)).toBe(true);

      unregisterPlugin(customPluginName);
      expect(hasPlugin(customPluginName)).toBe(false);
    });
  });
});

describe('Full Pipeline Integration', () => {
  it('should create a working pipeline from config', async () => {
    const config: JsonConfig = {
      site: {
        title: 'Test Site',
        baseUrl: 'https://example.com',
        sourceDir: '_src',
        layoutsDir: '_layouts'
      },
      metadata: {
        rootpath: '/'
      },
      pipeline: [
        'markdown',
        { excerpts: { marker: '<!-- more -->' } },
        { collections: {
          posts: { pattern: '_src/posts/**/*.html', sortBy: 'date', reverse: true }
        }},
        { permalinks: {
          match: ['**/*.html'],
          directoryIndex: 'index.html'
        }},
        { layouts: {
          directory: '_layouts',
          default: 'default.njk'
        }}
      ]
    };

    const pipeline = createPipelineFromConfig(config);

    // Create test files
    const files: VirtualFileMap = new Map();
    const encoder = new TextEncoder();

    files.set('_src/posts/hello.md', {
      path: '_src/posts/hello.md',
      contents: encoder.encode('---\ntitle: Hello World\ndate: 2024-01-01\n---\n# Hello\n\nContent here.'),
      metadata: {},
      sourcePath: '_src/posts/hello.md'
    });

    files.set('_layouts/default.njk', {
      path: '_layouts/default.njk',
      contents: encoder.encode('<html><body>{{ content }}</body></html>'),
      metadata: {},
      sourcePath: '_layouts/default.njk'
    });

    // Process should not throw
    const result = await pipeline.process(files);
    expect(result).toBeDefined();
  });
});

describe('JSON Schema', () => {
  it('should export the schema via getConfigSchema()', () => {
    const schema = getConfigSchema();

    expect(schema).toBeDefined();
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://janos.dev/schemas/janos.config.schema.json');
    expect(schema.title).toBe('Janos Configuration');
  });

  it('should export the schema directly', () => {
    expect(janosConfigSchema).toBeDefined();
    expect(janosConfigSchema.type).toBe('object');
  });

  it('should have required properties defined', () => {
    const schema = getConfigSchema();

    expect(schema.required).toContain('site');
    expect(schema.required).toContain('pipeline');
  });

  it('should have site config definition', () => {
    const schema = getConfigSchema();
    const siteConfig = schema.$defs?.siteConfig;

    expect(siteConfig).toBeDefined();
    expect(siteConfig?.required).toContain('title');
    expect(siteConfig?.required).toContain('baseUrl');
  });

  it('should have plugin definitions', () => {
    const schema = getConfigSchema();
    const defs = schema.$defs;

    expect(defs?.markdownPlugin).toBeDefined();
    expect(defs?.layoutsPlugin).toBeDefined();
    expect(defs?.collectionsPlugin).toBeDefined();
    expect(defs?.paginationPlugin).toBeDefined();
    expect(defs?.permalinksPlugin).toBeDefined();
    expect(defs?.assetsPlugin).toBeDefined();
  });

  it('should list all built-in plugins in pluginConfig enum', () => {
    const schema = getConfigSchema();
    const pluginConfig = schema.$defs?.pluginConfig;

    // Find the string enum option
    const stringEnum = pluginConfig?.oneOf?.find(
      (opt: unknown) => typeof opt === 'object' && opt !== null && 'enum' in opt
    ) as { enum?: string[] } | undefined;

    expect(stringEnum?.enum).toContain('markdown');
    expect(stringEnum?.enum).toContain('layouts');
    expect(stringEnum?.enum).toContain('collections');
    expect(stringEnum?.enum).toContain('permalinks');
  });
});
