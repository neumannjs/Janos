/**
 * Handlebars template engine implementation
 */
import Handlebars from 'handlebars';
import type { TemplateEngine } from '../pipeline/types.js';

/**
 * Options for Handlebars engine
 */
export interface HandlebarsOptions {
  /** Partials to register */
  partials?: Record<string, string>;
  /** Helpers to register */
  helpers?: Record<string, Handlebars.HelperDelegate>;
  /** Strict mode - throw on missing variables */
  strict?: boolean;
  /** Assume all inputs are safe (no escaping) */
  noEscape?: boolean;
}

/**
 * Create a Handlebars instance with the given options
 */
function createInstance(options: HandlebarsOptions = {}): typeof Handlebars {
  const { partials = {}, helpers = {} } = options;

  // Create isolated instance
  const hbs = Handlebars.create();

  // Register partials
  for (const [name, template] of Object.entries(partials)) {
    hbs.registerPartial(name, template);
  }

  // Register helpers
  for (const [name, fn] of Object.entries(helpers)) {
    hbs.registerHelper(name, fn);
  }

  return hbs;
}

/**
 * Create a Handlebars template engine
 * @param options - Engine options
 * @returns Template engine
 */
export function createHandlebarsEngine(options: HandlebarsOptions = {}): TemplateEngine {
  const hbs = createInstance(options);
  const { strict = false, noEscape = false } = options;

  // Cache compiled templates
  const templateCache = new Map<string, Handlebars.TemplateDelegate>();

  return {
    name: 'handlebars',
    extensions: ['.hbs', '.handlebars', '.html'],

    async render(template: string, data: Record<string, unknown>): Promise<string> {
      // Check cache first
      let compiled = templateCache.get(template);
      if (!compiled) {
        compiled = hbs.compile(template, { strict, noEscape });
        templateCache.set(template, compiled);
      }

      return compiled(data);
    },

    registerHelper(name: string, fn: (...args: unknown[]) => unknown): void {
      hbs.registerHelper(name, fn as Handlebars.HelperDelegate);
    },
  };
}

/**
 * Built-in date helper for Handlebars
 */
export function dateHelper(date: Date | string | number, options?: Handlebars.HelperOptions): string {
  const format = typeof options?.hash?.['format'] === 'string' ? options.hash['format'] : undefined;
  const d = date instanceof Date ? date : new Date(date as string | number);

  if (isNaN(d.getTime())) {
    return String(date);
  }

  if (!format) {
    return d.toISOString();
  }

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
 * JSON helper for Handlebars
 */
export function jsonHelper(context: unknown): Handlebars.SafeString {
  return new Handlebars.SafeString(JSON.stringify(context, null, 2));
}

/**
 * Comparison helper for Handlebars
 */
export function eqHelper(this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions): string {
  if (a === b) {
    return options.fn(this);
  }
  return options.inverse(this);
}

/**
 * Create a Handlebars engine with common helpers pre-registered
 */
export function createHandlebarsEngineWithDefaults(options: HandlebarsOptions = {}): TemplateEngine {
  return createHandlebarsEngine({
    ...options,
    helpers: {
      date: dateHelper,
      json: jsonHelper,
      eq: eqHelper,
      ...options.helpers,
    },
  });
}
