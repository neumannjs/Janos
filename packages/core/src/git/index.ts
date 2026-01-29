/**
 * Git module
 *
 * Provides abstract git interface with isomorphic-git backend.
 */

// Types
export type {
  IGitProvider,
  IRemoteProvider,
  GitProviderConfig,
  GitProviderFactory,
  GitFileStatus,
  GitStatusCode,
  GitCommit,
  GitBranch,
  GitRemote,
  GitTag,
  GitProgress,
  AuthResult,
  CloneOptions,
  FetchOptions,
  PushOptions,
  PullOptions,
  CommitOptions,
  LogOptions,
} from './types.js';

// Errors
export {
  GitError,
  GitAuthError,
  GitRefNotFoundError,
  GitMergeConflictError,
  GitDirtyWorkdirError,
  GitPushRejectedError,
  GitNotARepoError,
  GitTimeoutError,
  GitNetworkError,
  mapGitError,
  isGitError,
  isGitErrorCode,
} from './errors.js';

// Implementations
export { IsomorphicGitProvider, createIsomorphicGit } from './isomorphic.js';
