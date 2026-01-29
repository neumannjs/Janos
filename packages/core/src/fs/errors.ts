/**
 * Base class for filesystem errors
 */
export class FileSystemError extends Error {
  readonly code: string;
  readonly path: string;
  readonly syscall?: string;

  constructor(message: string, code: string, path: string, syscall?: string) {
    super(message);
    this.name = 'FileSystemError';
    this.code = code;
    this.path = path;
    this.syscall = syscall;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileSystemError);
    }
  }
}

/**
 * Error thrown when a file or directory is not found
 */
export class FileNotFoundError extends FileSystemError {
  constructor(path: string, syscall?: string) {
    super(`ENOENT: no such file or directory, ${syscall ?? 'access'} '${path}'`, 'ENOENT', path, syscall);
    this.name = 'FileNotFoundError';
  }
}

/**
 * Error thrown when a file or directory already exists
 */
export class FileExistsError extends FileSystemError {
  constructor(path: string, syscall?: string) {
    super(`EEXIST: file already exists, ${syscall ?? 'open'} '${path}'`, 'EEXIST', path, syscall);
    this.name = 'FileExistsError';
  }
}

/**
 * Error thrown when trying to perform file operations on a directory
 */
export class IsDirectoryError extends FileSystemError {
  constructor(path: string, syscall?: string) {
    super(`EISDIR: illegal operation on a directory, ${syscall ?? 'read'} '${path}'`, 'EISDIR', path, syscall);
    this.name = 'IsDirectoryError';
  }
}

/**
 * Error thrown when trying to perform directory operations on a file
 */
export class NotDirectoryError extends FileSystemError {
  constructor(path: string, syscall?: string) {
    super(`ENOTDIR: not a directory, ${syscall ?? 'scandir'} '${path}'`, 'ENOTDIR', path, syscall);
    this.name = 'NotDirectoryError';
  }
}

/**
 * Error thrown when trying to remove a non-empty directory
 */
export class DirectoryNotEmptyError extends FileSystemError {
  constructor(path: string, syscall?: string) {
    super(`ENOTEMPTY: directory not empty, ${syscall ?? 'rmdir'} '${path}'`, 'ENOTEMPTY', path, syscall);
    this.name = 'DirectoryNotEmptyError';
  }
}

/**
 * Error thrown when permission is denied
 */
export class PermissionDeniedError extends FileSystemError {
  constructor(path: string, syscall?: string) {
    super(`EACCES: permission denied, ${syscall ?? 'access'} '${path}'`, 'EACCES', path, syscall);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Error thrown when an invalid argument is provided
 */
export class InvalidArgumentError extends FileSystemError {
  constructor(path: string, syscall?: string) {
    super(`EINVAL: invalid argument, ${syscall ?? 'operation'} '${path}'`, 'EINVAL', path, syscall);
    this.name = 'InvalidArgumentError';
  }
}

/**
 * Map Node.js/ZenFS error codes to our error classes
 */
export function mapError(error: unknown, path: string, syscall?: string): FileSystemError {
  if (error instanceof FileSystemError) {
    return error;
  }

  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    switch (code) {
      case 'ENOENT':
        return new FileNotFoundError(path, syscall);
      case 'EEXIST':
        return new FileExistsError(path, syscall);
      case 'EISDIR':
        return new IsDirectoryError(path, syscall);
      case 'ENOTDIR':
        return new NotDirectoryError(path, syscall);
      case 'ENOTEMPTY':
        return new DirectoryNotEmptyError(path, syscall);
      case 'EACCES':
      case 'EPERM':
        return new PermissionDeniedError(path, syscall);
      case 'EINVAL':
        return new InvalidArgumentError(path, syscall);
      default:
        return new FileSystemError(error.message, code ?? 'UNKNOWN', path, syscall);
    }
  }

  return new FileSystemError(String(error), 'UNKNOWN', path, syscall);
}

/**
 * Type guard to check if an error is a FileSystemError
 */
export function isFileSystemError(error: unknown): error is FileSystemError {
  return error instanceof FileSystemError;
}

/**
 * Type guard to check for specific error codes
 */
export function isErrorCode(error: unknown, code: string): boolean {
  return isFileSystemError(error) && error.code === code;
}
