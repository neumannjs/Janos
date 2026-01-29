/**
 * Git provider types and interfaces
 */

import type { IFileSystem } from '../fs/types.js';

/**
 * Git file status
 */
export type GitStatusCode =
  | 'unmodified'
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'ignored'
  | 'absent';

/**
 * Status of a single file
 */
export interface GitFileStatus {
  /** File path relative to repository root */
  path: string;
  /** Status in the HEAD commit */
  headStatus: GitStatusCode;
  /** Status in the staging area (index) */
  stagedStatus: GitStatusCode;
  /** Status in the working directory */
  workdirStatus: GitStatusCode;
}

/**
 * Git commit information
 */
export interface GitCommit {
  /** Commit SHA */
  oid: string;
  /** Commit message */
  message: string;
  /** Author name */
  authorName: string;
  /** Author email */
  authorEmail: string;
  /** Commit timestamp (milliseconds since epoch) */
  timestamp: number;
  /** Parent commit SHAs */
  parents: string[];
}

/**
 * Git branch information
 */
export interface GitBranch {
  /** Branch name */
  name: string;
  /** Current commit SHA */
  oid: string;
  /** True if this is the current branch */
  isCurrent: boolean;
  /** Remote tracking branch (if any) */
  upstream?: string;
  /** Commits ahead of upstream */
  ahead?: number;
  /** Commits behind upstream */
  behind?: number;
}

/**
 * Git remote information
 */
export interface GitRemote {
  /** Remote name (e.g., 'origin') */
  name: string;
  /** Fetch URL */
  url: string;
  /** Push URL (if different) */
  pushUrl?: string;
}

/**
 * Git tag information
 */
export interface GitTag {
  /** Tag name */
  name: string;
  /** Tagged commit SHA */
  oid: string;
  /** Tag message (for annotated tags) */
  message?: string;
  /** Tagger name (for annotated tags) */
  taggerName?: string;
  /** Tag timestamp (for annotated tags) */
  timestamp?: number;
}

/**
 * Options for clone operation
 */
export interface CloneOptions {
  /** URL to clone from */
  url: string;
  /** Branch to checkout (default: default branch) */
  ref?: string;
  /** Clone only a single branch */
  singleBranch?: boolean;
  /** Limit clone depth */
  depth?: number;
  /** Authentication callback */
  onAuth?: () => AuthResult | Promise<AuthResult>;
  /** Progress callback */
  onProgress?: (progress: GitProgress) => void;
}

/**
 * Options for fetch operation
 */
export interface FetchOptions {
  /** Remote name (default: 'origin') */
  remote?: string;
  /** Branch to fetch */
  ref?: string;
  /** Fetch tags */
  tags?: boolean;
  /** Prune deleted remote branches */
  prune?: boolean;
  /** Authentication callback */
  onAuth?: () => AuthResult | Promise<AuthResult>;
  /** Progress callback */
  onProgress?: (progress: GitProgress) => void;
}

/**
 * Options for push operation
 */
export interface PushOptions {
  /** Remote name (default: 'origin') */
  remote?: string;
  /** Branch to push */
  ref?: string;
  /** Force push */
  force?: boolean;
  /** Set upstream tracking */
  setUpstream?: boolean;
  /** Authentication callback */
  onAuth?: () => AuthResult | Promise<AuthResult>;
  /** Progress callback */
  onProgress?: (progress: GitProgress) => void;
}

/**
 * Options for pull operation
 */
export interface PullOptions {
  /** Remote name (default: 'origin') */
  remote?: string;
  /** Branch to pull */
  ref?: string;
  /** Rebase instead of merge */
  rebase?: boolean;
  /** Authentication callback */
  onAuth?: () => AuthResult | Promise<AuthResult>;
  /** Progress callback */
  onProgress?: (progress: GitProgress) => void;
}

/**
 * Options for commit operation
 */
export interface CommitOptions {
  /** Commit message */
  message: string;
  /** Author name (uses config if not specified) */
  authorName?: string;
  /** Author email (uses config if not specified) */
  authorEmail?: string;
  /** Committer name (uses author if not specified) */
  committerName?: string;
  /** Committer email (uses author if not specified) */
  committerEmail?: string;
  /** Amend the previous commit */
  amend?: boolean;
}

/**
 * Options for log operation
 */
export interface LogOptions {
  /** Starting ref (default: HEAD) */
  ref?: string;
  /** Maximum number of commits */
  depth?: number;
  /** Only commits affecting this path */
  path?: string;
}

/**
 * Authentication result
 */
export interface AuthResult {
  /** Username or 'x-access-token' for tokens */
  username: string;
  /** Password or access token */
  password: string;
}

/**
 * Progress information for git operations
 */
export interface GitProgress {
  /** Current phase */
  phase: string;
  /** Objects loaded */
  loaded?: number;
  /** Total objects */
  total?: number;
}

/**
 * Remote provider for platform-specific features
 * (GitHub, GitLab, Gitea specific operations)
 */
export interface IRemoteProvider {
  /** Provider type */
  readonly type: 'github' | 'gitlab' | 'gitea' | 'generic';

  /**
   * Create a pull/merge request
   */
  createPullRequest?(options: {
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<{ number: number; url: string }>;

  /**
   * Get repository topics/labels
   */
  getTopics?(): Promise<string[]>;

  /**
   * Get repository info
   */
  getRepositoryInfo?(): Promise<{
    name: string;
    fullName: string;
    description: string;
    defaultBranch: string;
    private: boolean;
  }>;
}

/**
 * Git provider configuration
 */
export interface GitProviderConfig {
  /** Filesystem to use */
  fs: IFileSystem;
  /** Working directory path */
  dir: string;
  /** Author name for commits */
  authorName?: string;
  /** Author email for commits */
  authorEmail?: string;
  /** Default authentication callback */
  onAuth?: () => AuthResult | Promise<AuthResult>;
}

/**
 * Abstract Git provider interface
 *
 * This interface provides a unified API for git operations that works
 * across different backends (isomorphic-git, native git CLI, etc.).
 */
export interface IGitProvider {
  /**
   * Initialize a new repository
   * @param options - Initialization options
   */
  init(options?: { defaultBranch?: string }): Promise<void>;

  /**
   * Clone a repository
   * @param options - Clone options including URL
   */
  clone(options: CloneOptions): Promise<void>;

  /**
   * Get repository status
   * @returns Array of file statuses
   */
  status(): Promise<GitFileStatus[]>;

  /**
   * Stage files for commit
   * @param filepath - Path to stage (or '*' for all)
   */
  add(filepath: string): Promise<void>;

  /**
   * Unstage files
   * @param filepath - Path to unstage
   */
  reset(filepath: string): Promise<void>;

  /**
   * Remove files from the working tree and index
   * @param filepath - Path to remove
   * @param options - Remove options
   */
  remove(filepath: string, options?: { cached?: boolean }): Promise<void>;

  /**
   * Create a commit
   * @param options - Commit options including message
   * @returns Commit SHA
   */
  commit(options: CommitOptions): Promise<string>;

  /**
   * Get commit history
   * @param options - Log options
   * @returns Array of commits
   */
  log(options?: LogOptions): Promise<GitCommit[]>;

  /**
   * Checkout a branch or commit
   * @param ref - Branch name or commit SHA
   * @param options - Checkout options
   */
  checkout(ref: string, options?: { create?: boolean; force?: boolean }): Promise<void>;

  /**
   * Create a new branch
   * @param name - Branch name
   * @param options - Branch options
   */
  branch(name: string, options?: { ref?: string; checkout?: boolean }): Promise<void>;

  /**
   * Delete a branch
   * @param name - Branch name
   * @param options - Delete options
   */
  deleteBranch(name: string, options?: { force?: boolean }): Promise<void>;

  /**
   * List branches
   * @returns Array of branches
   */
  listBranches(): Promise<GitBranch[]>;

  /**
   * Get the current branch name
   * @returns Current branch name or null if detached
   */
  currentBranch(): Promise<string | null>;

  /**
   * Merge a branch into the current branch
   * @param ref - Branch to merge
   * @param options - Merge options
   * @returns Merge commit SHA
   */
  merge(ref: string, options?: { message?: string; noFastForward?: boolean }): Promise<string>;

  /**
   * Fetch from remote
   * @param options - Fetch options
   */
  fetch(options?: FetchOptions): Promise<void>;

  /**
   * Push to remote
   * @param options - Push options
   */
  push(options?: PushOptions): Promise<void>;

  /**
   * Pull from remote
   * @param options - Pull options
   * @returns New HEAD commit SHA
   */
  pull(options?: PullOptions): Promise<string>;

  /**
   * List remotes
   * @returns Array of remotes
   */
  listRemotes(): Promise<GitRemote[]>;

  /**
   * Add a remote
   * @param name - Remote name
   * @param url - Remote URL
   */
  addRemote(name: string, url: string): Promise<void>;

  /**
   * Remove a remote
   * @param name - Remote name
   */
  removeRemote(name: string): Promise<void>;

  /**
   * Read a file at a specific ref
   * @param path - File path
   * @param options - Read options
   * @returns File contents
   */
  readFile(path: string, options?: { ref?: string }): Promise<Uint8Array>;

  /**
   * Get the SHA of a ref
   * @param ref - Reference (branch, tag, or SHA)
   * @returns Full SHA
   */
  resolveRef(ref: string): Promise<string>;

  /**
   * List files in a tree
   * @param options - Tree options
   * @returns Array of file paths
   */
  listFiles(options?: { ref?: string }): Promise<string[]>;

  /**
   * Get config value
   * @param key - Config key (e.g., 'user.name')
   * @returns Config value or undefined
   */
  getConfig(key: string): Promise<string | undefined>;

  /**
   * Set config value
   * @param key - Config key
   * @param value - Config value
   */
  setConfig(key: string, value: string): Promise<void>;

  /**
   * Get the remote provider for platform-specific features
   * @returns Remote provider or null
   */
  getRemoteProvider(): IRemoteProvider | null;
}

/**
 * Factory function type for creating git provider instances
 */
export type GitProviderFactory = (config: GitProviderConfig) => IGitProvider;
