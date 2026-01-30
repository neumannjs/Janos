/**
 * JSON Schema exports for Janos configuration
 *
 * The schema can be used for:
 * - Editor autocomplete (via $schema reference in config files)
 * - Runtime validation
 * - Documentation generation
 */

// Import schema as JSON
import schema from './janos.config.schema.json' with { type: 'json' };

/**
 * The Janos configuration JSON Schema
 */
export const janosConfigSchema = schema;

/**
 * Schema $id for external reference
 */
export const SCHEMA_ID = 'https://janos.dev/schemas/janos.config.schema.json';

/**
 * Schema version (matches JSON Schema draft)
 */
export const SCHEMA_DRAFT = 'https://json-schema.org/draft/2020-12/schema';

export default schema;
