/**
 * ZenFS-based filesystem implementation for browser environments
 *
 * Uses IndexedDB as the backing store for persistent file storage.
 */
import { configure, fs as zenfs } from '@zenfs/core';
import { IndexedDB } from '@zenfs/dom';
import type {
  IFileSystem,
  FileStat,
  MkdirOptions,
  RmOptions,
  WriteFileOptions,
  ReadFileOptions,
  ReaddirOptions,
  CopyOptions,
  Dirent,
  WatchCallback,
  FileWatcher,
} from './types.js';
import { mapError, FileNotFoundError } from './errors.js';
import { normalizePath, dirname, stringToBytes, bytesToString } from './utils.js';

/**
 * Configuration options for ZenFS filesystem
 */
export interface ZenFSOptions {
  /** Name of the IndexedDB database */
  dbName?: string;
}

/**
 * ZenFS-based filesystem implementation
 *
 * Provides a node:fs compatible API backed by IndexedDB for browser persistence.
 */
export class ZenFSFileSystem implements IFileSystem {
  private initialized = false;
  private readonly options: ZenFSOptions;

  constructor(options: ZenFSOptions = {}) {
    this.options = options;
  }

  /**
   * Initialize the filesystem
   * Must be called before any other operations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await configure({
      mounts: {
        '/': {
          backend: IndexedDB,
          storeName: this.options.dbName ?? 'janos-fs',
        },
      },
    } as any);

    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Filesystem not initialized. Call initialize() first.');
    }
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: ReadFileOptions & { encoding: BufferEncoding }): Promise<string>;
  async readFile(path: string, options?: ReadFileOptions): Promise<Uint8Array | string> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      const data = await zenfs.promises.readFile(normalized);

      if (options?.encoding) {
        return bytesToString(data);
      }

      return data;
    } catch (error) {
      throw mapError(error, normalized, 'read');
    }
  }

  async writeFile(path: string, data: Uint8Array | string, options?: WriteFileOptions): Promise<void> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      // Ensure parent directory exists
      const dir = dirname(normalized);
      if (dir !== '/' && dir !== '.') {
        try {
          await zenfs.promises.access(dir);
        } catch {
          throw new FileNotFoundError(dir, 'open');
        }
      }

      const bytes = typeof data === 'string' ? stringToBytes(data) : data;
      const writeOptions = options?.mode !== undefined ? { mode: options.mode } : undefined;
      await zenfs.promises.writeFile(normalized, bytes, writeOptions);
    } catch (error) {
      throw mapError(error, normalized, 'write');
    }
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: ReaddirOptions & { withFileTypes: true }): Promise<Dirent[]>;
  async readdir(path: string, options?: ReaddirOptions): Promise<string[] | Dirent[]> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      if (options?.withFileTypes) {
        const entries = await zenfs.promises.readdir(normalized, { withFileTypes: true });
        return entries.map((entry) => ({
          name: entry.name,
          isDirectory: () => entry.isDirectory(),
          isFile: () => entry.isFile(),
          isSymbolicLink: () => entry.isSymbolicLink(),
        }));
      }

      return await zenfs.promises.readdir(normalized);
    } catch (error) {
      throw mapError(error, normalized, 'readdir');
    }
  }

  async stat(path: string): Promise<FileStat> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      const stats = await zenfs.promises.stat(normalized);
      return {
        size: stats.size,
        mtime: stats.mtimeMs,
        ctime: stats.ctimeMs,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isSymbolicLink: stats.isSymbolicLink(),
        mode: stats.mode,
      };
    } catch (error) {
      throw mapError(error, normalized, 'stat');
    }
  }

  async lstat(path: string): Promise<FileStat> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      const stats = await zenfs.promises.lstat(normalized);
      return {
        size: stats.size,
        mtime: stats.mtimeMs,
        ctime: stats.ctimeMs,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isSymbolicLink: stats.isSymbolicLink(),
        mode: stats.mode,
      };
    } catch (error) {
      throw mapError(error, normalized, 'lstat');
    }
  }

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      await zenfs.promises.mkdir(normalized, {
        recursive: options?.recursive,
        mode: options?.mode,
      });
    } catch (error) {
      throw mapError(error, normalized, 'mkdir');
    }
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      await zenfs.promises.rm(normalized, {
        recursive: options?.recursive,
        force: options?.force,
      });
    } catch (error) {
      if (options?.force) {
        // Silently ignore if force is set
        return;
      }
      throw mapError(error, normalized, 'rm');
    }
  }

  async rmdir(path: string): Promise<void> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      await zenfs.promises.rmdir(normalized);
    } catch (error) {
      throw mapError(error, normalized, 'rmdir');
    }
  }

  async unlink(path: string): Promise<void> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      await zenfs.promises.unlink(normalized);
    } catch (error) {
      throw mapError(error, normalized, 'unlink');
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    this.ensureInitialized();
    const normalizedOld = normalizePath(oldPath);
    const normalizedNew = normalizePath(newPath);

    try {
      await zenfs.promises.rename(normalizedOld, normalizedNew);
    } catch (error) {
      throw mapError(error, normalizedOld, 'rename');
    }
  }

  async copyFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    this.ensureInitialized();
    const normalizedSrc = normalizePath(src);
    const normalizedDest = normalizePath(dest);

    try {
      await zenfs.promises.copyFile(normalizedSrc, normalizedDest);
    } catch (error) {
      throw mapError(error, normalizedSrc, 'copyFile');
    }
  }

  async exists(path: string): Promise<boolean> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      await zenfs.promises.access(normalized);
      return true;
    } catch {
      return false;
    }
  }

  async readlink(path: string): Promise<string> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      return await zenfs.promises.readlink(normalized);
    } catch (error) {
      throw mapError(error, normalized, 'readlink');
    }
  }

  async symlink(target: string, path: string): Promise<void> {
    this.ensureInitialized();
    const normalizedPath = normalizePath(path);

    try {
      await zenfs.promises.symlink(target, normalizedPath);
    } catch (error) {
      throw mapError(error, normalizedPath, 'symlink');
    }
  }

  watch(path: string, callback: WatchCallback): FileWatcher {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    // ZenFS watch support may be limited; provide a basic implementation
    const watcher = zenfs.watch(normalized, (eventType, filename) => {
      callback(eventType as 'rename' | 'change', filename as string | null);
    });

    return {
      close: () => watcher.close(),
    };
  }

  async realpath(path: string): Promise<string> {
    this.ensureInitialized();
    const normalized = normalizePath(path);

    try {
      return await zenfs.promises.realpath(normalized);
    } catch (error) {
      throw mapError(error, normalized, 'realpath');
    }
  }
}

/**
 * Create and initialize a ZenFS filesystem instance
 * @param options - Configuration options
 * @returns Initialized filesystem
 */
export async function createZenFS(options?: ZenFSOptions): Promise<IFileSystem> {
  const fs = new ZenFSFileSystem(options);
  await fs.initialize();
  return fs;
}
