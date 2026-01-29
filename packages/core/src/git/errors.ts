/**
 * Git-specific error types
 */

/**
 * Base class for git errors
 */
export class GitError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'GitError';
    this.code = code;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GitError);
    }
  }
}

/**
 * Error thrown when authentication fails
 */
export class GitAuthError extends GitError {
  readonly url?: string;

  constructor(message: string, url?: string) {
    super(message, 'AUTH_FAILED');
    this.name = 'GitAuthError';
    this.url = url;
  }
}

/**
 * Error thrown when a ref is not found
 */
export class GitRefNotFoundError extends GitError {
  readonly ref: string;

  constructor(ref: string) {
    super(`Reference not found: ${ref}`, 'REF_NOT_FOUND');
    this.name = 'GitRefNotFoundError';
    this.ref = ref;
  }
}

/**
 * Error thrown when a merge conflict occurs
 */
export class GitMergeConflictError extends GitError {
  readonly conflictedFiles: string[];

  constructor(conflictedFiles: string[]) {
    super(`Merge conflict in: ${conflictedFiles.join(', ')}`, 'MERGE_CONFLICT');
    this.name = 'GitMergeConflictError';
    this.conflictedFiles = conflictedFiles;
  }
}

/**
 * Error thrown when the working directory has uncommitted changes
 */
export class GitDirtyWorkdirError extends GitError {
  readonly files: string[];

  constructor(files: string[]) {
    super('Working directory has uncommitted changes', 'DIRTY_WORKDIR');
    this.name = 'GitDirtyWorkdirError';
    this.files = files;
  }
}

/**
 * Error thrown when push is rejected (non-fast-forward)
 */
export class GitPushRejectedError extends GitError {
  readonly ref?: string;

  constructor(message: string, ref?: string) {
    super(message, 'PUSH_REJECTED');
    this.name = 'GitPushRejectedError';
    this.ref = ref;
  }
}

/**
 * Error thrown when repository is not initialized
 */
export class GitNotARepoError extends GitError {
  readonly dir: string;

  constructor(dir: string) {
    super(`Not a git repository: ${dir}`, 'NOT_A_REPO');
    this.name = 'GitNotARepoError';
    this.dir = dir;
  }
}

/**
 * Error thrown when a remote operation times out
 */
export class GitTimeoutError extends GitError {
  readonly operation: string;

  constructor(operation: string) {
    super(`Operation timed out: ${operation}`, 'TIMEOUT');
    this.name = 'GitTimeoutError';
    this.operation = operation;
  }
}

/**
 * Error thrown when network is unavailable
 */
export class GitNetworkError extends GitError {
  readonly url?: string;

  constructor(message: string, url?: string) {
    super(message, 'NETWORK_ERROR');
    this.name = 'GitNetworkError';
    this.url = url;
  }
}

/**
 * Map isomorphic-git errors to our error types
 */
export function mapGitError(error: unknown): GitError {
  if (error instanceof GitError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message;
    const errorName = error.name;

    // isomorphic-git specific error names
    if (errorName === 'HttpError' || message.includes('401') || message.includes('403')) {
      return new GitAuthError(message);
    }

    if (errorName === 'NotFoundError' || message.includes('Could not find')) {
      const refMatch = message.match(/ref '([^']+)'/);
      if (refMatch?.[1]) {
        return new GitRefNotFoundError(refMatch[1]);
      }
    }

    if (message.includes('CONFLICT') || message.includes('merge conflict')) {
      return new GitMergeConflictError([]);
    }

    if (message.includes('uncommitted changes') || message.includes('dirty')) {
      return new GitDirtyWorkdirError([]);
    }

    if (message.includes('rejected') || message.includes('non-fast-forward')) {
      return new GitPushRejectedError(message);
    }

    if (message.includes('not a git repository')) {
      return new GitNotARepoError('');
    }

    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return new GitTimeoutError('remote operation');
    }

    if (message.includes('network') || message.includes('ENOTFOUND') || message.includes('fetch')) {
      return new GitNetworkError(message);
    }

    return new GitError(message, 'UNKNOWN');
  }

  return new GitError(String(error), 'UNKNOWN');
}

/**
 * Type guard to check if an error is a GitError
 */
export function isGitError(error: unknown): error is GitError {
  return error instanceof GitError;
}

/**
 * Type guard to check for specific git error codes
 */
export function isGitErrorCode(error: unknown, code: string): boolean {
  return isGitError(error) && error.code === code;
}
