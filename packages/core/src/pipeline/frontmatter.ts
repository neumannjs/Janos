/**
 * Frontmatter parsing utilities
 *
 * Uses gray-matter for robust YAML frontmatter parsing.
 */
import matter from 'gray-matter';
import type { FileMetadata, VirtualFile } from './types.js';
import { FrontmatterError } from './errors.js';

/**
 * Result of parsing frontmatter
 */
export interface FrontmatterResult {
  /** Parsed metadata */
  metadata: FileMetadata;
  /** Content after frontmatter */
  content: string;
  /** True if frontmatter was present */
  hasFrontmatter: boolean;
}

/**
 * Parse YAML frontmatter from content using gray-matter
 *
 * @param content - File content
 * @param filePath - File path for error messages
 * @returns Parsed frontmatter and content
 */
export function parseFrontmatter(content: string, filePath?: string): FrontmatterResult {
  try {
    const result = matter(content);

    // Check if there was actually frontmatter
    const hasFrontmatter = content.trimStart().startsWith('---');

    return {
      metadata: result.data as FileMetadata,
      content: result.content,
      hasFrontmatter,
    };
  } catch (error) {
    throw new FrontmatterError(
      filePath ?? 'unknown',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Stringify metadata to frontmatter
 * @param metadata - Metadata to stringify
 * @returns YAML-like frontmatter string (without delimiters)
 */
export function stringifyFrontmatter(metadata: FileMetadata): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${stringifyValue(value)}`);
  }

  return lines.join('\n');
}

/**
 * Stringify a value for frontmatter
 */
function stringifyValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString().split('T')[0]!;
  if (Array.isArray(value)) {
    return '[' + value.map(stringifyValue).join(', ') + ']';
  }
  if (typeof value === 'string') {
    if (value.includes(':') || value.includes('#') || value.includes('"')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  return String(value);
}

/**
 * Extract frontmatter from a virtual file
 * @param file - Virtual file
 * @returns Frontmatter result
 */
export function extractFrontmatter(file: VirtualFile): FrontmatterResult {
  const decoder = new TextDecoder();
  const content = decoder.decode(file.contents);
  return parseFrontmatter(content, file.path);
}

/**
 * Apply frontmatter to a virtual file's content
 * @param content - File content
 * @param metadata - Metadata to prepend
 * @returns Content with frontmatter
 */
export function applyFrontmatter(content: string, metadata: FileMetadata): string {
  const frontmatter = stringifyFrontmatter(metadata);
  return `---\n${frontmatter}\n---\n\n${content}`;
}
