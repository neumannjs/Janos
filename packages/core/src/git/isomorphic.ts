/**
 * isomorphic-git based Git provider implementation
 *
 * Works in both browser and Node.js environments.
 */
import * as git from 'isomorphic-git';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - isomorphic-git http module types
import http from 'isomorphic-git/http/web';
import type { IFileSystem } from '../fs/types.js';
import type {
  IGitProvider,
  IRemoteProvider,
  GitProviderConfig,
  GitFileStatus,
  GitCommit,
  GitBranch,
  GitRemote,
  CloneOptions,
  FetchOptions,
  PushOptions,
  PullOptions,
  CommitOptions,
  LogOptions,
  AuthResult,
  GitStatusCode,
} from './types.js';
import { mapGitError, GitRefNotFoundError } from './errors.js';

/**
 * Adapter to make our IFileSystem compatible with isomorphic-git's FS interface
 */
function createFsAdapter(fs: IFileSystem): git.PromiseFsClient {
  return {
    promises: {
      readFile: async (filepath: string, options?: { encoding?: string }) => {
        const data = await fs.readFile(filepath);
        if (options?.encoding === 'utf8') {
          return new TextDecoder().decode(data);
        }
        return Buffer.from(data);
      },
      writeFile: async (filepath: string, data: string | Uint8Array) => {
        await fs.writeFile(filepath, typeof data === 'string' ? data : new Uint8Array(data));
      },
      unlink: async (filepath: string) => {
        await fs.unlink(filepath);
      },
      readdir: async (filepath: string) => {
        return await fs.readdir(filepath);
      },
      mkdir: async (filepath: string, options?: { mode?: number }) => {
        const mkdirOptions = options?.mode !== undefined ? { mode: options.mode } : undefined;
        await fs.mkdir(filepath, mkdirOptions);
      },
      rmdir: async (filepath: string) => {
        await fs.rmdir(filepath);
      },
      stat: async (filepath: string) => {
        const statResult = await fs.stat(filepath);
        return {
          isFile: () => statResult.isFile,
          isDirectory: () => statResult.isDirectory,
          isSymbolicLink: () => statResult.isSymbolicLink,
          size: statResult.size,
          mode: statResult.mode,
          mtimeMs: statResult.mtime,
          ctimeMs: statResult.ctime,
        };
      },
      lstat: async (filepath: string) => {
        const lstatResult = await fs.lstat(filepath);
        return {
          isFile: () => lstatResult.isFile,
          isDirectory: () => lstatResult.isDirectory,
          isSymbolicLink: () => lstatResult.isSymbolicLink,
          size: lstatResult.size,
          mode: lstatResult.mode,
          mtimeMs: lstatResult.mtime,
          ctimeMs: lstatResult.ctime,
        };
      },
      readlink: async (filepath: string) => {
        return await fs.readlink(filepath);
      },
      symlink: async (target: string, filepath: string) => {
        await fs.symlink(target, filepath);
      },
      chmod: async (_filepath: string, _mode: number) => {
        // Not all backends support chmod
      },
    },
  };
}

/**
 * Convert isomorphic-git status matrix to our GitFileStatus
 */
function convertStatus(matrix: [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3][]): GitFileStatus[] {
  const statusMap: Record<number, GitStatusCode> = {
    0: 'absent',
    1: 'unmodified',
    2: 'modified',
    3: 'added',
  };

  return matrix.map(([filepath, head, workdir, stage]) => ({
    path: filepath,
    headStatus: head === 0 ? 'absent' : 'unmodified',
    workdirStatus: statusMap[workdir] ?? 'unmodified',
    stagedStatus: statusMap[stage] ?? 'unmodified',
  }));
}

/**
 * isomorphic-git based Git provider
 */
export class IsomorphicGitProvider implements IGitProvider {
  private readonly fs: IFileSystem;
  private readonly fsAdapter: git.PromiseFsClient;
  private readonly dir: string;
  private authorName?: string;
  private authorEmail?: string;
  private defaultOnAuth?: () => AuthResult | Promise<AuthResult>;
  private remoteProvider: IRemoteProvider | null = null;

  constructor(config: GitProviderConfig) {
    this.fs = config.fs;
    this.fsAdapter = createFsAdapter(config.fs);
    this.dir = config.dir;
    this.authorName = config.authorName;
    this.authorEmail = config.authorEmail;
    this.defaultOnAuth = config.onAuth;
  }

  private getAuthCallback(onAuth?: () => AuthResult | Promise<AuthResult>): git.AuthCallback | undefined {
    const authFn = onAuth ?? this.defaultOnAuth;
    if (!authFn) return undefined;

    return async (_url: string) => {
      const result = await authFn();
      return result;
    };
  }

  async init(options?: { defaultBranch?: string }): Promise<void> {
    try {
      await git.init({
        fs: this.fsAdapter,
        dir: this.dir,
        defaultBranch: options?.defaultBranch ?? 'main',
      });
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async clone(options: CloneOptions): Promise<void> {
    try {
      await git.clone({
        fs: this.fsAdapter,
        http,
        dir: this.dir,
        url: options.url,
        ref: options.ref,
        singleBranch: options.singleBranch,
        depth: options.depth,
        onAuth: this.getAuthCallback(options.onAuth),
        onProgress: options.onProgress,
      });
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async status(): Promise<GitFileStatus[]> {
    try {
      const matrix = await git.statusMatrix({
        fs: this.fsAdapter,
        dir: this.dir,
      });
      return convertStatus(matrix);
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async add(filepath: string): Promise<void> {
    try {
      if (filepath === '*' || filepath === '.') {
        // Stage all files
        const matrix = await git.statusMatrix({
          fs: this.fsAdapter,
          dir: this.dir,
        });

        for (const [file, , workdir] of matrix) {
          if (workdir !== 1) {
            // Not unmodified
            await git.add({
              fs: this.fsAdapter,
              dir: this.dir,
              filepath: file,
            });
          }
        }
      } else {
        await git.add({
          fs: this.fsAdapter,
          dir: this.dir,
          filepath,
        });
      }
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async reset(filepath: string): Promise<void> {
    try {
      await git.resetIndex({
        fs: this.fsAdapter,
        dir: this.dir,
        filepath,
      });
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async remove(filepath: string, options?: { cached?: boolean }): Promise<void> {
    try {
      await git.remove({
        fs: this.fsAdapter,
        dir: this.dir,
        filepath,
      });

      if (!options?.cached) {
        // Also delete from working directory
        await this.fs.rm(this.dir + '/' + filepath, { force: true });
      }
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async commit(options: CommitOptions): Promise<string> {
    try {
      const authorName = options.authorName ?? this.authorName;
      const authorEmail = options.authorEmail ?? this.authorEmail;

      if (!authorName || !authorEmail) {
        // Try to get from config
        const configName = await this.getConfig('user.name');
        const configEmail = await this.getConfig('user.email');

        if (!configName || !configEmail) {
          throw new Error('Author name and email are required for commits');
        }
      }

      const sha = await git.commit({
        fs: this.fsAdapter,
        dir: this.dir,
        message: options.message,
        author: {
          name: authorName ?? (await this.getConfig('user.name'))!,
          email: authorEmail ?? (await this.getConfig('user.email'))!,
        },
        committer: {
          name: options.committerName ?? authorName ?? (await this.getConfig('user.name'))!,
          email: options.committerEmail ?? authorEmail ?? (await this.getConfig('user.email'))!,
        },
      });

      return sha;
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async log(options?: LogOptions): Promise<GitCommit[]> {
    try {
      const commits = await git.log({
        fs: this.fsAdapter,
        dir: this.dir,
        ref: options?.ref ?? 'HEAD',
        depth: options?.depth,
        filepath: options?.path,
      });

      return commits.map((c) => ({
        oid: c.oid,
        message: c.commit.message,
        authorName: c.commit.author.name,
        authorEmail: c.commit.author.email,
        timestamp: c.commit.author.timestamp * 1000, // Convert to milliseconds
        parents: c.commit.parent,
      }));
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async checkout(ref: string, options?: { create?: boolean; force?: boolean }): Promise<void> {
    try {
      if (options?.create) {
        await this.branch(ref, { checkout: true });
        return;
      }

      await git.checkout({
        fs: this.fsAdapter,
        dir: this.dir,
        ref,
        force: options?.force,
      });
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async branch(name: string, options?: { ref?: string; checkout?: boolean }): Promise<void> {
    try {
      await git.branch({
        fs: this.fsAdapter,
        dir: this.dir,
        ref: name,
        object: options?.ref,
        checkout: options?.checkout,
      });
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async deleteBranch(name: string, options?: { force?: boolean }): Promise<void> {
    try {
      await git.deleteBranch({
        fs: this.fsAdapter,
        dir: this.dir,
        ref: name,
      });
    } catch (error) {
      if (!options?.force) {
        throw mapGitError(error);
      }
    }
  }

  async listBranches(): Promise<GitBranch[]> {
    try {
      const branches = await git.listBranches({
        fs: this.fsAdapter,
        dir: this.dir,
      });

      const currentBranch = await this.currentBranch();

      const result: GitBranch[] = [];
      for (const name of branches) {
        try {
          const oid = await git.resolveRef({
            fs: this.fsAdapter,
            dir: this.dir,
            ref: name,
          });

          result.push({
            name,
            oid,
            isCurrent: name === currentBranch,
          });
        } catch {
          // Skip branches that can't be resolved
        }
      }

      return result;
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async currentBranch(): Promise<string | null> {
    try {
      const branch = await git.currentBranch({
        fs: this.fsAdapter,
        dir: this.dir,
        fullname: false,
      });
      return branch ?? null;
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async merge(ref: string, options?: { message?: string; noFastForward?: boolean }): Promise<string> {
    try {
      const result = await git.merge({
        fs: this.fsAdapter,
        dir: this.dir,
        ours: await this.currentBranch() ?? 'HEAD',
        theirs: ref,
        fastForward: !options?.noFastForward,
        message: options?.message,
        author: {
          name: this.authorName ?? (await this.getConfig('user.name'))!,
          email: this.authorEmail ?? (await this.getConfig('user.email'))!,
        },
      });

      return result.oid ?? (await this.resolveRef('HEAD'));
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async fetch(options?: FetchOptions): Promise<void> {
    try {
      await git.fetch({
        fs: this.fsAdapter,
        http,
        dir: this.dir,
        remote: options?.remote ?? 'origin',
        ref: options?.ref,
        tags: options?.tags,
        prune: options?.prune,
        onAuth: this.getAuthCallback(options?.onAuth),
        onProgress: options?.onProgress,
      });
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async push(options?: PushOptions): Promise<void> {
    try {
      await git.push({
        fs: this.fsAdapter,
        http,
        dir: this.dir,
        remote: options?.remote ?? 'origin',
        ref: options?.ref,
        force: options?.force,
        onAuth: this.getAuthCallback(options?.onAuth),
        onProgress: options?.onProgress,
      });
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async pull(options?: PullOptions): Promise<string> {
    try {
      await git.pull({
        fs: this.fsAdapter,
        http,
        dir: this.dir,
        remote: options?.remote ?? 'origin',
        ref: options?.ref,
        singleBranch: true,
        onAuth: this.getAuthCallback(options?.onAuth),
        onProgress: options?.onProgress,
        author: {
          name: this.authorName ?? (await this.getConfig('user.name'))!,
          email: this.authorEmail ?? (await this.getConfig('user.email'))!,
        },
      });

      return await this.resolveRef('HEAD');
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async listRemotes(): Promise<GitRemote[]> {
    try {
      const remotes = await git.listRemotes({
        fs: this.fsAdapter,
        dir: this.dir,
      });

      return remotes.map((r) => ({
        name: r.remote,
        url: r.url,
      }));
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async addRemote(name: string, url: string): Promise<void> {
    try {
      await git.addRemote({
        fs: this.fsAdapter,
        dir: this.dir,
        remote: name,
        url,
      });
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async removeRemote(name: string): Promise<void> {
    try {
      await git.deleteRemote({
        fs: this.fsAdapter,
        dir: this.dir,
        remote: name,
      });
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async readFile(path: string, options?: { ref?: string }): Promise<Uint8Array> {
    try {
      const ref = options?.ref ?? 'HEAD';

      const { blob } = await git.readBlob({
        fs: this.fsAdapter,
        dir: this.dir,
        oid: await this.resolveRef(ref),
        filepath: path,
      });

      return blob;
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async resolveRef(ref: string): Promise<string> {
    try {
      return await git.resolveRef({
        fs: this.fsAdapter,
        dir: this.dir,
        ref,
      });
    } catch (error) {
      throw new GitRefNotFoundError(ref);
    }
  }

  async listFiles(options?: { ref?: string }): Promise<string[]> {
    try {
      const ref = options?.ref ?? 'HEAD';

      const files = await git.listFiles({
        fs: this.fsAdapter,
        dir: this.dir,
        ref,
      });

      return files;
    } catch (error) {
      throw mapGitError(error);
    }
  }

  async getConfig(key: string): Promise<string | undefined> {
    try {
      const value = await git.getConfig({
        fs: this.fsAdapter,
        dir: this.dir,
        path: key,
      });
      return value ?? undefined;
    } catch {
      return undefined;
    }
  }

  async setConfig(key: string, value: string): Promise<void> {
    try {
      await git.setConfig({
        fs: this.fsAdapter,
        dir: this.dir,
        path: key,
        value,
      });
    } catch (error) {
      throw mapGitError(error);
    }
  }

  /**
   * Check if the directory is a git repository
   */
  async isRepository(): Promise<boolean> {
    try {
      await git.resolveRef({
        fs: this.fsAdapter,
        dir: this.dir,
        ref: 'HEAD',
      });
      return true;
    } catch {
      return false;
    }
  }

  getRemoteProvider(): IRemoteProvider | null {
    return this.remoteProvider;
  }

  /**
   * Set the remote provider for platform-specific features
   */
  setRemoteProvider(provider: IRemoteProvider): void {
    this.remoteProvider = provider;
  }
}

/**
 * Create an isomorphic-git provider instance
 * @param config - Provider configuration
 * @returns Git provider
 */
export function createIsomorphicGit(config: GitProviderConfig): IGitProvider {
  return new IsomorphicGitProvider(config);
}
