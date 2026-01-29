/**
 * Tests for Handlebars template engine
 */
import { describe, it, expect } from 'vitest';
import {
  createHandlebarsEngine,
  createHandlebarsEngineWithDefaults,
  dateHelper,
  jsonHelper,
  eqHelper,
} from './handlebars.js';
import Handlebars from 'handlebars';

describe('Handlebars Template Engine', () => {
  describe('createHandlebarsEngine', () => {
    it('should create an engine with correct name', () => {
      const engine = createHandlebarsEngine();
      expect(engine.name).toBe('handlebars');
    });

    it('should have correct extensions', () => {
      const engine = createHandlebarsEngine();
      expect(engine.extensions).toContain('.hbs');
      expect(engine.extensions).toContain('.handlebars');
      expect(engine.extensions).toContain('.html');
    });

    it('should render simple template', async () => {
      const engine = createHandlebarsEngine();
      const result = await engine.render('Hello {{name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should render loops', async () => {
      const engine = createHandlebarsEngine();
      const template = '{{#each items}}{{this}}{{/each}}';
      const result = await engine.render(template, { items: ['a', 'b', 'c'] });
      expect(result).toBe('abc');
    });

    it('should render conditionals', async () => {
      const engine = createHandlebarsEngine();
      const template = '{{#if show}}visible{{else}}hidden{{/if}}';

      const resultTrue = await engine.render(template, { show: true });
      expect(resultTrue).toBe('visible');

      const resultFalse = await engine.render(template, { show: false });
      expect(resultFalse).toBe('hidden');
    });

    it('should escape HTML by default', async () => {
      const engine = createHandlebarsEngine();
      const result = await engine.render('{{html}}', { html: '<script>alert("xss")</script>' });
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should allow triple-stash for unescaped HTML', async () => {
      const engine = createHandlebarsEngine();
      const result = await engine.render('{{{html}}}', { html: '<div>test</div>' });
      expect(result).toBe('<div>test</div>');
    });

    it('should register custom partials', async () => {
      const engine = createHandlebarsEngine({
        partials: {
          header: '<header>{{title}}</header>',
        },
      });
      const result = await engine.render('{{> header}}', { title: 'My Site' });
      expect(result).toBe('<header>My Site</header>');
    });

    it('should register custom helpers', async () => {
      const engine = createHandlebarsEngine({
        helpers: {
          loud: (text: string) => text.toUpperCase(),
        },
      });
      const result = await engine.render('{{loud text}}', { text: 'hello' });
      expect(result).toBe('HELLO');
    });

    it('should allow registering helpers via registerHelper', async () => {
      const engine = createHandlebarsEngine();
      engine.registerHelper('double', (num: unknown) => (Number(num) || 0) * 2);
      const result = await engine.render('{{double num}}', { num: 5 });
      expect(result).toBe('10');
    });

    it('should cache compiled templates', async () => {
      const engine = createHandlebarsEngine();
      const template = 'Hello {{name}}!';

      // First render compiles the template
      const result1 = await engine.render(template, { name: 'World' });
      // Second render uses cached version
      const result2 = await engine.render(template, { name: 'Universe' });

      expect(result1).toBe('Hello World!');
      expect(result2).toBe('Hello Universe!');
    });
  });

  describe('createHandlebarsEngineWithDefaults', () => {
    it('should have date helper', async () => {
      const engine = createHandlebarsEngineWithDefaults();
      const result = await engine.render('{{date d}}', { d: new Date('2024-01-15T12:00:00Z') });
      expect(result).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should have json helper', async () => {
      const engine = createHandlebarsEngineWithDefaults();
      const result = await engine.render('{{{json obj}}}', { obj: { a: 1 } });
      expect(result).toContain('"a": 1');
    });

    it('should have eq helper', async () => {
      const engine = createHandlebarsEngineWithDefaults();
      const template = '{{#eq status "active"}}yes{{else}}no{{/eq}}';

      const resultActive = await engine.render(template, { status: 'active' });
      expect(resultActive).toBe('yes');

      const resultInactive = await engine.render(template, { status: 'inactive' });
      expect(resultInactive).toBe('no');
    });
  });

  describe('dateHelper', () => {
    it('should format Date objects', () => {
      const date = new Date('2024-03-15T10:30:00Z');
      const options = { hash: { format: 'YYYY-MM-DD' } } as Handlebars.HelperOptions;
      expect(dateHelper(date, options)).toBe('2024-03-15');
    });

    it('should handle date strings', () => {
      const options = { hash: { format: 'YYYY-MM-DD' } } as Handlebars.HelperOptions;
      expect(dateHelper('2024-06-20', options)).toBe('2024-06-20');
    });

    it('should return ISO string without format', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      expect(dateHelper(date)).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should handle invalid dates', () => {
      expect(dateHelper('not-a-date')).toBe('not-a-date');
    });
  });

  describe('jsonHelper', () => {
    it('should stringify objects', () => {
      const result = jsonHelper({ a: 1, b: 2 });
      expect(result.toString()).toContain('"a": 1');
      expect(result.toString()).toContain('"b": 2');
    });

    it('should return SafeString', () => {
      const result = jsonHelper({});
      expect(result).toBeInstanceOf(Handlebars.SafeString);
    });
  });

  describe('eqHelper', () => {
    it('should return fn result for equal values', () => {
      const options = {
        fn: () => 'yes',
        inverse: () => 'no',
      } as unknown as Handlebars.HelperOptions;

      const result = eqHelper.call({}, 'a', 'a', options);
      expect(result).toBe('yes');
    });

    it('should return inverse result for unequal values', () => {
      const options = {
        fn: () => 'yes',
        inverse: () => 'no',
      } as unknown as Handlebars.HelperOptions;

      const result = eqHelper.call({}, 'a', 'b', options);
      expect(result).toBe('no');
    });
  });
});
