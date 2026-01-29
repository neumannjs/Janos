/**
 * Tests for pipeline implementation
 */
import { describe, it, expect, vi } from 'vitest';
import {
  Pipeline,
  createPipeline,
  createVirtualFile,
  getFileContents,
  setFileContents,
} from './pipeline.js';
import type { PipelinePlugin, VirtualFile, PipelineConfig } from './types.js';

const createTestConfig = (overrides: Partial<PipelineConfig> = {}): PipelineConfig => ({
  site: {
    title: 'Test Site',
    baseUrl: 'https://example.com',
    sourceDir: 'src',
    outputDir: 'dist',
    ...overrides.site,
  },
  mode: overrides.mode ?? 'development',
  ...overrides,
});

describe('Pipeline', () => {
  describe('createVirtualFile', () => {
    it('should create a virtual file with default metadata', () => {
      const file = createVirtualFile('test.txt', 'Hello World');
      expect(file.path).toBe('test.txt');
      expect(file.metadata).toEqual({});
      expect(getFileContents(file)).toBe('Hello World');
    });

    it('should create a virtual file with custom metadata', () => {
      const file = createVirtualFile('test.txt', 'Hello', { title: 'Test' });
      expect(file.metadata.title).toBe('Test');
    });

    it('should accept Uint8Array contents', () => {
      const encoder = new TextEncoder();
      const contents = encoder.encode('Binary content');
      const file = createVirtualFile('test.bin', contents);
      expect(file.contents).toBe(contents);
    });
  });

  describe('getFileContents / setFileContents', () => {
    it('should read and write string contents', () => {
      const file = createVirtualFile('test.txt', '');
      setFileContents(file, 'New content');
      expect(getFileContents(file)).toBe('New content');
    });

    it('should handle UTF-8 encoding correctly', () => {
      const file = createVirtualFile('test.txt', '');
      setFileContents(file, 'Unicode: 日本語 🎉');
      expect(getFileContents(file)).toBe('Unicode: 日本語 🎉');
    });
  });

  describe('Pipeline class', () => {
    it('should create a pipeline with valid config', () => {
      const pipeline = new Pipeline(createTestConfig());
      expect(pipeline).toBeInstanceOf(Pipeline);
    });

    it('should throw on missing site title', () => {
      expect(() => new Pipeline({
        site: { title: '', baseUrl: 'https://example.com', sourceDir: 'src', outputDir: 'dist' },
      })).toThrow('Site title is required');
    });

    it('should throw on missing base URL', () => {
      expect(() => new Pipeline({
        site: { title: 'Test', baseUrl: '', sourceDir: 'src', outputDir: 'dist' },
      })).toThrow('Site base URL is required');
    });

    it('should allow chaining use() calls', () => {
      const plugin: PipelinePlugin = () => {};
      const pipeline = new Pipeline(createTestConfig());
      const result = pipeline.use(plugin);
      expect(result).toBe(pipeline);
    });

    it('should run plugins in order', async () => {
      const order: number[] = [];

      const plugin1: PipelinePlugin = () => { order.push(1); };
      const plugin2: PipelinePlugin = () => { order.push(2); };
      const plugin3: PipelinePlugin = () => { order.push(3); };

      const pipeline = new Pipeline(createTestConfig());
      pipeline.use(plugin1).use(plugin2).use(plugin3);

      const files = new Map<string, VirtualFile>();
      await pipeline.process(files);
      expect(order).toEqual([1, 2, 3]);
    });

    it('should pass files to plugins', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('test.txt', createVirtualFile('test.txt', 'Hello'));

      let receivedFiles: Map<string, VirtualFile> | undefined;
      const plugin: PipelinePlugin = (f) => { receivedFiles = f; };

      const pipeline = new Pipeline(createTestConfig());
      pipeline.use(plugin);

      await pipeline.process(files);
      expect(receivedFiles).toBeDefined();
      expect(receivedFiles!.has('test.txt')).toBe(true);
    });

    it('should allow plugins to modify files', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('test.txt', createVirtualFile('test.txt', 'Hello'));

      const plugin: PipelinePlugin = (f) => {
        const file = f.get('test.txt')!;
        setFileContents(file, 'Modified');
      };

      const pipeline = new Pipeline(createTestConfig());
      pipeline.use(plugin);

      await pipeline.process(files);
      expect(getFileContents(files.get('test.txt')!)).toBe('Modified');
    });

    it('should allow plugins to add files', async () => {
      const files = new Map<string, VirtualFile>();

      const plugin: PipelinePlugin = (f) => {
        f.set('new.txt', createVirtualFile('new.txt', 'New file'));
      };

      const pipeline = new Pipeline(createTestConfig());
      pipeline.use(plugin);

      await pipeline.process(files);
      expect(files.has('new.txt')).toBe(true);
    });

    it('should allow plugins to delete files', async () => {
      const files = new Map<string, VirtualFile>();
      files.set('delete-me.txt', createVirtualFile('delete-me.txt', 'Goodbye'));

      const plugin: PipelinePlugin = (f) => {
        f.delete('delete-me.txt');
      };

      const pipeline = new Pipeline(createTestConfig());
      pipeline.use(plugin);

      await pipeline.process(files);
      expect(files.has('delete-me.txt')).toBe(false);
    });

    it('should handle async plugins', async () => {
      const files = new Map<string, VirtualFile>();

      const plugin: PipelinePlugin = async (f) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        f.set('async.txt', createVirtualFile('async.txt', 'Async content'));
      };

      const pipeline = new Pipeline(createTestConfig());
      pipeline.use(plugin);

      await pipeline.process(files);
      expect(files.has('async.txt')).toBe(true);
    });

    it('should provide context to plugins', async () => {
      let receivedContext: Parameters<PipelinePlugin>[1] | undefined;

      const plugin: PipelinePlugin = (_, ctx) => {
        receivedContext = ctx;
      };

      const pipeline = new Pipeline(createTestConfig());
      pipeline.use(plugin);

      const files = new Map<string, VirtualFile>();
      await pipeline.process(files);

      expect(receivedContext).toBeDefined();
      expect(receivedContext!.metadata.site.title).toBe('Test Site');
      expect(typeof receivedContext!.log).toBe('function');
    });

    it('should call event callbacks', async () => {
      const onStart = vi.fn();
      const onComplete = vi.fn();
      const onPluginStart = vi.fn();
      const onPluginEnd = vi.fn();

      const pipeline = new Pipeline(createTestConfig({
        events: {
          onStart,
          onComplete,
          onPluginStart,
          onPluginEnd,
        },
      }));

      const plugin: PipelinePlugin = () => {};
      pipeline.use(plugin);

      await pipeline.build();

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onPluginStart).toHaveBeenCalled();
      expect(onPluginEnd).toHaveBeenCalled();
    });

    it('should return build result', async () => {
      const pipeline = new Pipeline(createTestConfig());
      const result = await pipeline.build();

      expect(result).toHaveProperty('filesProcessed');
      expect(result).toHaveProperty('filesOutput');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('createPipeline', () => {
    it('should create a pipeline with factory function', () => {
      const pipeline = createPipeline(createTestConfig());
      expect(pipeline).toBeDefined();
    });
  });

  describe('Pipeline with template engines', () => {
    it('should register template engines', async () => {
      const mockEngine = {
        name: 'mock',
        extensions: ['.mock'],
        render: vi.fn().mockResolvedValue('rendered'),
      };

      let foundEngine = false;

      const plugin: PipelinePlugin = (_, ctx) => {
        foundEngine = ctx.templateEngines.has('.mock');
      };

      const pipeline = new Pipeline(createTestConfig());
      pipeline.engine(mockEngine);
      pipeline.use(plugin);

      const files = new Map<string, VirtualFile>();
      await pipeline.process(files);
      expect(foundEngine).toBe(true);
    });
  });

  describe('Pipeline metadata', () => {
    it('should allow adding global metadata', async () => {
      let customValue: unknown;

      const plugin: PipelinePlugin = (_, ctx) => {
        customValue = ctx.metadata['customKey'];
      };

      const pipeline = new Pipeline(createTestConfig());
      pipeline.metadata('customKey', 'customValue');
      pipeline.use(plugin);

      const files = new Map<string, VirtualFile>();
      await pipeline.process(files);
      expect(customValue).toBe('customValue');
    });
  });
});
