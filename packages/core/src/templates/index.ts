/**
 * Template engines module
 *
 * Placeholder for template engine implementations.
 * Will include Nunjucks, Handlebars, and Markdown engines.
 */

import type { TemplateEngine } from '../pipeline/types.js';

/**
 * Create a simple passthrough template engine for testing
 */
export function createPassthroughEngine(): TemplateEngine {
  return {
    name: 'passthrough',
    extensions: ['.html', '.txt'],
    async render(template: string, _data: Record<string, unknown>): Promise<string> {
      return template;
    },
  };
}

/**
 * Create a simple variable interpolation engine
 * Replaces {{ variable }} with data values
 */
export function createSimpleEngine(): TemplateEngine {
  return {
    name: 'simple',
    extensions: ['.html', '.txt'],
    async render(template: string, data: Record<string, unknown>): Promise<string> {
      return template.replace(/\{\{\s*(\w+(?:\.\w+)*)\s*\}\}/g, (_, path: string) => {
        const parts = path.split('.');
        let value: unknown = data;
        for (const part of parts) {
          if (value && typeof value === 'object') {
            value = (value as Record<string, unknown>)[part];
          } else {
            return '';
          }
        }
        return String(value ?? '');
      });
    },
  };
}

// Re-export TemplateEngine type
export type { TemplateEngine } from '../pipeline/types.js';
