/**
 * Nunjucks template engine implementation
 */
import nunjucks from 'nunjucks';
import type { TemplateEngine, VirtualFile } from '../pipeline/types.js';

/**
 * Nunjucks loader interface
 */
export interface NunjucksLoader {
  async?: boolean;
  getSource: (name: string, callback: (err: Error | null, result?: { src: string; path: string; noCache?: boolean }) => void) => void;
}

/**
 * Options for Nunjucks engine
 */
export interface NunjucksOptions {
  /** Template search paths */
  paths?: string[];
  /** Auto-escape HTML (default: true) */
  autoescape?: boolean;
  /** Throw on undefined variables (default: false) */
  throwOnUndefined?: boolean;
  /** Enable caching (default: true in production) */
  noCache?: boolean;
  /** Custom filters */
  filters?: Record<string, (...args: unknown[]) => unknown>;
  /** Custom globals */
  globals?: Record<string, unknown>;
  /** Async loader for templates */
  loader?: NunjucksLoader;
}

/**
 * Create a Nunjucks loader that reads from a virtual file map
 *
 * This enables {% extends %} and {% include %} to work with templates
 * stored in the pipeline's virtual filesystem.
 *
 * @param files - Map of virtual files (path -> VirtualFile)
 * @param baseDir - Base directory for template resolution (e.g., '_layouts')
 * @returns Nunjucks loader
 */
export function createVirtualLoader(
  files: Map<string, VirtualFile>,
  baseDir: string = ''
): NunjucksLoader {
  const decoder = new TextDecoder('utf-8');
  const prefix = baseDir ? (baseDir.endsWith('/') ? baseDir : baseDir + '/') : '';

  return {
    async: true,
    getSource(name: string, callback: (err: Error | null, result?: { src: string; path: string; noCache?: boolean }) => void): void {
      // Normalize the template name
      let templatePath = name;

      // If the name doesn't start with the prefix, add it
      if (prefix && !name.startsWith(prefix)) {
        templatePath = prefix + name;
      }

      // Try to find the template
      const file = files.get(templatePath);

      if (file) {
        try {
          const src = decoder.decode(file.contents);
          callback(null, {
            src,
            path: templatePath,
            noCache: true, // Disable caching for virtual files
          });
        } catch (err) {
          callback(err instanceof Error ? err : new Error(String(err)));
        }
      } else {
        // Try without the prefix (for absolute paths in templates)
        const absoluteFile = files.get(name);
        if (absoluteFile) {
          try {
            const src = decoder.decode(absoluteFile.contents);
            callback(null, {
              src,
              path: name,
              noCache: true,
            });
          } catch (err) {
            callback(err instanceof Error ? err : new Error(String(err)));
          }
        } else {
          callback(new Error(`Template not found: ${name} (tried: ${templatePath}, ${name})`));
        }
      }
    },
  };
}

/**
 * Create a Nunjucks environment with the given options
 */
function createEnvironment(options: NunjucksOptions = {}): nunjucks.Environment {
  const {
    paths = [],
    autoescape = true,
    throwOnUndefined = false,
    noCache = false,
    filters = {},
    globals = {},
    loader,
  } = options;

  let env: nunjucks.Environment;

  if (loader) {
    // Create a custom loader
    const customLoader = {
      async: true,
      getSource: loader.getSource,
    };
    env = new nunjucks.Environment(customLoader as nunjucks.ILoader, {
      autoescape,
      throwOnUndefined,
      noCache,
    });
  } else if (paths.length > 0) {
    // Use file system loader (Node.js only)
    env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(paths, { noCache }),
      { autoescape, throwOnUndefined }
    );
  } else {
    // No loader, templates must be passed as strings
    env = new nunjucks.Environment(null, {
      autoescape,
      throwOnUndefined,
      noCache,
    });
  }

  // Register filters
  for (const [name, fn] of Object.entries(filters)) {
    env.addFilter(name, fn as (...args: unknown[]) => unknown);
  }

  // Register globals
  for (const [name, value] of Object.entries(globals)) {
    env.addGlobal(name, value);
  }

  return env;
}

/**
 * Create a Nunjucks template engine
 * @param options - Engine options
 * @returns Template engine
 */
export function createNunjucksEngine(options: NunjucksOptions = {}): TemplateEngine {
  const env = createEnvironment(options);

  return {
    name: 'nunjucks',
    extensions: ['.njk', '.nunjucks', '.html'],

    async render(template: string, data: Record<string, unknown>): Promise<string> {
      return new Promise((resolve, reject) => {
        env.renderString(template, data, (err: Error | null, result: string | null) => {
          if (err) {
            reject(err);
          } else {
            resolve(result ?? '');
          }
        });
      });
    },

    async renderFile(path: string, data: Record<string, unknown>): Promise<string> {
      return new Promise((resolve, reject) => {
        env.render(path, data, (err: Error | null, result: string | null) => {
          if (err) {
            reject(err);
          } else {
            resolve(result ?? '');
          }
        });
      });
    },

    registerHelper(name: string, fn: (...args: unknown[]) => unknown): void {
      env.addFilter(name, fn);
    },
  };
}

/**
 * Built-in date filter for Nunjucks
 */
export function dateFilter(date: Date | string | number, format?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    return String(date);
  }

  if (!format) {
    return d.toISOString();
  }

  // Simple format implementation
  const pad = (n: number) => n.toString().padStart(2, '0');

  return format
    .replace('YYYY', d.getFullYear().toString())
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()));
}

/**
 * Create a Nunjucks engine with common filters pre-registered
 */
export function createNunjucksEngineWithDefaults(options: NunjucksOptions = {}): TemplateEngine {
  return createNunjucksEngine({
    ...options,
    filters: {
      date: dateFilter as (...args: unknown[]) => unknown,
      json: (value: unknown) => JSON.stringify(value, null, 2),
      ...options.filters,
    },
  });
}
