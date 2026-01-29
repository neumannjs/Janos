/**
 * Pipeline-specific error types
 */

/**
 * Base class for pipeline errors
 */
export class PipelineError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'PipelineError';
    this.code = code;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PipelineError);
    }
  }
}

/**
 * Error thrown when a plugin fails
 */
export class PluginError extends PipelineError {
  override readonly name = 'PluginError';
  readonly pluginName: string;
  override readonly cause?: Error;

  constructor(pluginName: string, message: string, cause?: Error) {
    super(`Plugin '${pluginName}' failed: ${message}`, 'PLUGIN_ERROR');
    this.pluginName = pluginName;
    this.cause = cause;
  }
}

/**
 * Error thrown when a file cannot be processed
 */
export class FileProcessingError extends PipelineError {
  override readonly name = 'FileProcessingError';
  readonly filePath: string;
  override readonly cause?: Error;

  constructor(filePath: string, message: string, cause?: Error) {
    super(`Failed to process '${filePath}': ${message}`, 'FILE_PROCESSING_ERROR');
    this.filePath = filePath;
    this.cause = cause;
  }
}

/**
 * Error thrown when frontmatter parsing fails
 */
export class FrontmatterError extends PipelineError {
  readonly filePath: string;
  readonly line?: number;

  constructor(filePath: string, message: string, line?: number) {
    const lineInfo = line ? ` at line ${line}` : '';
    super(`Invalid frontmatter in '${filePath}'${lineInfo}: ${message}`, 'FRONTMATTER_ERROR');
    this.name = 'FrontmatterError';
    this.filePath = filePath;
    this.line = line;
  }
}

/**
 * Error thrown when a template cannot be rendered
 */
export class TemplateError extends PipelineError {
  override readonly name = 'TemplateError';
  readonly templatePath?: string;
  override readonly cause?: Error;

  constructor(message: string, templatePath?: string, cause?: Error) {
    const pathInfo = templatePath ? ` in '${templatePath}'` : '';
    super(`Template error${pathInfo}: ${message}`, 'TEMPLATE_ERROR');
    this.templatePath = templatePath;
    this.cause = cause;
  }
}

/**
 * Error thrown when a layout is not found
 */
export class LayoutNotFoundError extends PipelineError {
  readonly layoutName: string;
  readonly filePath?: string;

  constructor(layoutName: string, filePath?: string) {
    const fileInfo = filePath ? ` (requested by '${filePath}')` : '';
    super(`Layout '${layoutName}' not found${fileInfo}`, 'LAYOUT_NOT_FOUND');
    this.name = 'LayoutNotFoundError';
    this.layoutName = layoutName;
    this.filePath = filePath;
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigError extends PipelineError {
  readonly field?: string;

  constructor(message: string, field?: string) {
    const fieldInfo = field ? ` (${field})` : '';
    super(`Configuration error${fieldInfo}: ${message}`, 'CONFIG_ERROR');
    this.name = 'ConfigError';
    this.field = field;
  }
}

/**
 * Error thrown when a template engine is not registered
 */
export class EngineNotFoundError extends PipelineError {
  readonly extension: string;

  constructor(extension: string) {
    super(`No template engine registered for extension '${extension}'`, 'ENGINE_NOT_FOUND');
    this.name = 'EngineNotFoundError';
    this.extension = extension;
  }
}

/**
 * Type guard to check if an error is a PipelineError
 */
export function isPipelineError(error: unknown): error is PipelineError {
  return error instanceof PipelineError;
}

/**
 * Type guard to check for specific pipeline error codes
 */
export function isPipelineErrorCode(error: unknown, code: string): boolean {
  return isPipelineError(error) && error.code === code;
}
