/**
 * Tests for Nunjucks template engine
 */
import { describe, it, expect } from 'vitest';
import { createNunjucksEngine, createNunjucksEngineWithDefaults, dateFilter } from './nunjucks.js';

describe('Nunjucks Template Engine', () => {
  describe('createNunjucksEngine', () => {
    it('should create an engine with correct name', () => {
      const engine = createNunjucksEngine();
      expect(engine.name).toBe('nunjucks');
    });

    it('should have correct extensions', () => {
      const engine = createNunjucksEngine();
      expect(engine.extensions).toContain('.njk');
      expect(engine.extensions).toContain('.nunjucks');
      expect(engine.extensions).toContain('.html');
    });

    it('should render simple template', async () => {
      const engine = createNunjucksEngine();
      const result = await engine.render('Hello {{ name }}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should render loops', async () => {
      const engine = createNunjucksEngine();
      const template = '{% for item in items %}{{ item }}{% endfor %}';
      const result = await engine.render(template, { items: ['a', 'b', 'c'] });
      expect(result).toBe('abc');
    });

    it('should render conditionals', async () => {
      const engine = createNunjucksEngine();
      const template = '{% if show %}visible{% else %}hidden{% endif %}';

      const resultTrue = await engine.render(template, { show: true });
      expect(resultTrue).toBe('visible');

      const resultFalse = await engine.render(template, { show: false });
      expect(resultFalse).toBe('hidden');
    });

    it('should auto-escape HTML by default', async () => {
      const engine = createNunjucksEngine();
      const result = await engine.render('{{ html }}', { html: '<script>alert("xss")</script>' });
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should allow disabling auto-escape', async () => {
      const engine = createNunjucksEngine({ autoescape: false });
      const result = await engine.render('{{ html }}', { html: '<div>test</div>' });
      expect(result).toContain('<div>test</div>');
    });

    it('should use safe filter to bypass escaping', async () => {
      const engine = createNunjucksEngine();
      const result = await engine.render('{{ html | safe }}', { html: '<div>test</div>' });
      expect(result).toContain('<div>test</div>');
    });

    it('should register custom filters', async () => {
      const engine = createNunjucksEngine({
        filters: {
          double: (value: unknown) => (Number(value) || 0) * 2,
        },
      });
      const result = await engine.render('{{ num | double }}', { num: 5 });
      expect(result).toBe('10');
    });

    it('should register custom globals', async () => {
      const engine = createNunjucksEngine({
        globals: {
          siteName: 'My Site',
        },
      });
      const result = await engine.render('{{ siteName }}');
      expect(result).toBe('My Site');
    });

    it('should allow registering helpers via registerHelper', async () => {
      const engine = createNunjucksEngine();
      engine.registerHelper('triple', (value: unknown) => (Number(value) || 0) * 3);
      const result = await engine.render('{{ num | triple }}', { num: 3 });
      expect(result).toBe('9');
    });
  });

  describe('createNunjucksEngineWithDefaults', () => {
    it('should have date filter', async () => {
      const engine = createNunjucksEngineWithDefaults();
      const result = await engine.render('{{ d | date }}', { d: new Date('2024-01-15T12:00:00Z') });
      expect(result).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should format dates with pattern', async () => {
      const engine = createNunjucksEngineWithDefaults();
      const template = "{{ d | date('YYYY-MM-DD') }}";
      const result = await engine.render(template, { d: new Date('2024-01-15') });
      expect(result).toBe('2024-01-15');
    });

    it('should have json filter', async () => {
      const engine = createNunjucksEngineWithDefaults();
      const result = await engine.render('{{ obj | json | safe }}', { obj: { a: 1 } });
      expect(result).toContain('"a": 1');
    });
  });

  describe('dateFilter', () => {
    it('should format Date objects', () => {
      const date = new Date('2024-03-15T10:30:00Z');
      expect(dateFilter(date, 'YYYY-MM-DD')).toBe('2024-03-15');
    });

    it('should handle date strings', () => {
      expect(dateFilter('2024-06-20', 'YYYY-MM-DD')).toBe('2024-06-20');
    });

    it('should handle timestamps', () => {
      const timestamp = new Date('2024-12-25').getTime();
      expect(dateFilter(timestamp, 'MM/DD/YYYY')).toBe('12/25/2024');
    });

    it('should return ISO string without format', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      expect(dateFilter(date)).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should handle invalid dates', () => {
      expect(dateFilter('not-a-date')).toBe('not-a-date');
    });
  });
});
