/**
 * Frontmatter parsing utilities
 *
 * Supports YAML frontmatter delimited by ---
 */
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
 * Parse YAML-like frontmatter from content
 *
 * This is a simplified parser that handles common cases without
 * requiring a full YAML parser library.
 *
 * @param content - File content
 * @param filePath - File path for error messages
 * @returns Parsed frontmatter and content
 */
export function parseFrontmatter(content: string, filePath?: string): FrontmatterResult {
  const lines = content.split('\n');

  // Check for frontmatter delimiter at start
  if (lines.length === 0 || lines[0]?.trim() !== '---') {
    return {
      metadata: {},
      content,
      hasFrontmatter: false,
    };
  }

  // Find closing delimiter
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    throw new FrontmatterError(filePath ?? 'unknown', 'Unclosed frontmatter block');
  }

  // Parse frontmatter lines
  const frontmatterLines = lines.slice(1, endIndex);
  const metadata = parseYamlLike(frontmatterLines, filePath);

  // Get content after frontmatter
  const contentLines = lines.slice(endIndex + 1);
  const remainingContent = contentLines.join('\n');

  return {
    metadata,
    content: remainingContent.startsWith('\n') ? remainingContent.slice(1) : remainingContent,
    hasFrontmatter: true,
  };
}

/**
 * Simple YAML-like parser for frontmatter
 *
 * Supports:
 * - key: value pairs
 * - key: "quoted value"
 * - key: [array, items]
 * - nested objects (with indentation)
 * - boolean values (true/false)
 * - numbers
 * - dates (YYYY-MM-DD)
 */
function parseYamlLike(lines: string[], filePath?: string): FileMetadata {
  const result: FileMetadata = {};
  let currentKey: string | null = null;
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [{ obj: result, indent: 0 }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    // Calculate indentation
    const indent = line.length - line.trimStart().length;

    // Pop stack for dedented lines
    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1]!.obj;

    // Parse key: value
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      // Might be a list item
      if (trimmed.startsWith('- ')) {
        const value = parseValue(trimmed.slice(2));
        if (currentKey && Array.isArray(current[currentKey])) {
          (current[currentKey] as unknown[]).push(value);
        }
        continue;
      }

      throw new FrontmatterError(filePath ?? 'unknown', `Invalid line: ${trimmed}`, i + 2);
    }

    const key = trimmed.slice(0, colonIndex).trim();
    const valueStr = trimmed.slice(colonIndex + 1).trim();

    if (valueStr === '') {
      // Could be start of nested object or array
      const nextLine = lines[i + 1];
      if (nextLine?.trim().startsWith('- ')) {
        current[key] = [];
        currentKey = key;
      } else {
        // Nested object
        current[key] = {};
        stack.push({ obj: current[key] as Record<string, unknown>, indent });
      }
    } else {
      current[key] = parseValue(valueStr);
      currentKey = key;
    }
  }

  return result;
}

/**
 * Parse a YAML-like value
 */
function parseValue(str: string): unknown {
  const trimmed = str.trim();

  // Quoted string
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Array
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1);
    if (inner.trim() === '') return [];
    return inner.split(',').map((item) => parseValue(item.trim()));
  }

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Null
  if (trimmed === 'null' || trimmed === '~') return null;

  // Date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed + 'T00:00:00Z');
    if (!isNaN(date.getTime())) return date;
  }

  // DateTime (YYYY-MM-DDTHH:MM:SS)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Plain string
  return trimmed;
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
