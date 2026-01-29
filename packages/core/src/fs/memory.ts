/**
 * In-memory filesystem implementation for testing and temporary storage
 */
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
import {
  FileNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
} from './errors.js';
import { normalizePath, dirname, basename, stringToBytes, bytesToString } from './utils.js';

/**
 * Internal representation of a filesystem node
 */
interface FSNode {
  type: 'file' | 'directory' | 'symlink';
  content?: Uint8Array;
  target?: string; // For symlinks
  mode: number;
  mtime: number;
  ctime: number;
  children?: Map<string, FSNode>;
}

/**
 * In-memory filesystem implementation
 *
 * All data is stored in memory and lost when the instance is destroyed.
 * Useful for testing, temporary operations, and environments without persistence.
 */
export class MemoryFileSystem implements IFileSystem {
  private root: FSNode;
  private watchers: Map<string, Set<WatchCallback>> = new Map();

  constructor() {
    const now = Date.now();
    this.root = {
      type: 'directory',
      mode: 0o755,
      mtime: now,
      ctime: now,
      children: new Map(),
    };
  }

  /**
   * Get a node by path, optionally following symlinks
   */
  private getNode(path: string, followSymlinks = true): FSNode | null {
    const normalized = normalizePath(path);
    if (normalized === '/') return this.root;

    const parts = normalized.split('/').filter(Boolean);
    let current: FSNode = this.root;

    for (const part of parts) {
      if (current.type !== 'directory' || !current.children) {
        return null;
      }
      const next = current.children.get(part);
      if (!next) return null;

      if (followSymlinks && next.type === 'symlink' && next.target) {
        // Resolve symlink
        const resolved = this.getNode(next.target, true);
        if (!resolved) return null;
        current = resolved;
      } else {
        current = next;
      }
    }

    return current;
  }

  /**
   * Get the parent directory node and child name
   */
  private getParentAndName(path: string): { parent: FSNode; name: string } | null {
    const normalized = normalizePath(path);
    const parentPath = dirname(normalized);
    const name = basename(normalized);

    const parent = this.getNode(parentPath);
    if (!parent || parent.type !== 'directory') return null;

    return { parent, name };
  }

  /**
   * Emit watch events for a path
   */
  private emitWatch(path: string, eventType: 'rename' | 'change'): void {
    const normalized = normalizePath(path);
    const callbacks = this.watchers.get(normalized);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(eventType, basename(normalized));
      }
    }

    // Also notify parent directory
    const parentPath = dirname(normalized);
    const parentCallbacks = this.watchers.get(parentPath);
    if (parentCallbacks) {
      for (const cb of parentCallbacks) {
        cb('rename', basename(normalized));
      }
    }
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: ReadFileOptions & { encoding: BufferEncoding }): Promise<string>;
  async readFile(path: string, options?: ReadFileOptions): Promise<Uint8Array | string> {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized);

    if (!node) {
      throw new FileNotFoundError(normalized, 'read');
    }
    if (node.type === 'directory') {
      throw new IsDirectoryError(normalized, 'read');
    }
    if (node.type === 'symlink') {
      // Should have been resolved by getNode
      throw new FileNotFoundError(normalized, 'read');
    }

    const content = node.content ?? new Uint8Array(0);

    if (options?.encoding) {
      return bytesToString(content);
    }

    return content;
  }

  async writeFile(path: string, data: Uint8Array | string, options?: WriteFileOptions): Promise<void> {
    const normalized = normalizePath(path);
    const parentInfo = this.getParentAndName(normalized);

    if (!parentInfo) {
      throw new FileNotFoundError(dirname(normalized), 'open');
    }

    const { parent, name } = parentInfo;
    const content = typeof data === 'string' ? stringToBytes(data) : data;
    const now = Date.now();

    const existing = parent.children?.get(name);
    if (existing?.type === 'directory') {
      throw new IsDirectoryError(normalized, 'write');
    }

    parent.children!.set(name, {
      type: 'file',
      content,
      mode: options?.mode ?? 0o644,
      mtime: now,
      ctime: existing?.ctime ?? now,
    });

    this.emitWatch(normalized, existing ? 'change' : 'rename');
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: ReaddirOptions & { withFileTypes: true }): Promise<Dirent[]>;
  async readdir(path: string, options?: ReaddirOptions): Promise<string[] | Dirent[]> {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized);

    if (!node) {
      throw new FileNotFoundError(normalized, 'readdir');
    }
    if (node.type !== 'directory') {
      throw new NotDirectoryError(normalized, 'readdir');
    }

    const entries = Array.from(node.children?.keys() ?? []);

    if (options?.withFileTypes) {
      return entries.map((name) => {
        const child = node.children!.get(name)!;
        return {
          name,
          isDirectory: () => child.type === 'directory',
          isFile: () => child.type === 'file',
          isSymbolicLink: () => child.type === 'symlink',
        };
      });
    }

    return entries;
  }

  async stat(path: string): Promise<FileStat> {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized, true); // Follow symlinks

    if (!node) {
      throw new FileNotFoundError(normalized, 'stat');
    }

    return {
      size: node.content?.length ?? 0,
      mtime: node.mtime,
      ctime: node.ctime,
      isDirectory: node.type === 'directory',
      isFile: node.type === 'file',
      isSymbolicLink: false, // We followed symlinks
      mode: node.mode,
    };
  }

  async lstat(path: string): Promise<FileStat> {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized, false); // Don't follow symlinks

    if (!node) {
      throw new FileNotFoundError(normalized, 'lstat');
    }

    return {
      size: node.content?.length ?? 0,
      mtime: node.mtime,
      ctime: node.ctime,
      isDirectory: node.type === 'directory',
      isFile: node.type === 'file',
      isSymbolicLink: node.type === 'symlink',
      mode: node.mode,
    };
  }

  async mkdir(path: string, options?: MkdirOptions): Promise<void> {
    const normalized = normalizePath(path);

    if (options?.recursive) {
      // Create all parent directories
      const parts = normalized.split('/').filter(Boolean);
      let currentPath = '';

      for (const part of parts) {
        currentPath += '/' + part;
        const existing = this.getNode(currentPath);

        if (existing) {
          if (existing.type !== 'directory') {
            throw new FileExistsError(currentPath, 'mkdir');
          }
          continue;
        }

        const parentInfo = this.getParentAndName(currentPath);
        if (!parentInfo) {
          throw new FileNotFoundError(dirname(currentPath), 'mkdir');
        }

        const now = Date.now();
        parentInfo.parent.children!.set(parentInfo.name, {
          type: 'directory',
          mode: options?.mode ?? 0o755,
          mtime: now,
          ctime: now,
          children: new Map(),
        });
      }
    } else {
      const existing = this.getNode(normalized);
      if (existing) {
        throw new FileExistsError(normalized, 'mkdir');
      }

      const parentInfo = this.getParentAndName(normalized);
      if (!parentInfo) {
        throw new FileNotFoundError(dirname(normalized), 'mkdir');
      }

      const now = Date.now();
      parentInfo.parent.children!.set(parentInfo.name, {
        type: 'directory',
        mode: options?.mode ?? 0o755,
        mtime: now,
        ctime: now,
        children: new Map(),
      });
    }

    this.emitWatch(normalized, 'rename');
  }

  async rm(path: string, options?: RmOptions): Promise<void> {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized, false);

    if (!node) {
      if (options?.force) return;
      throw new FileNotFoundError(normalized, 'rm');
    }

    if (node.type === 'directory') {
      if (!options?.recursive) {
        if (node.children && node.children.size > 0) {
          throw new DirectoryNotEmptyError(normalized, 'rm');
        }
      }
    }

    const parentInfo = this.getParentAndName(normalized);
    if (parentInfo) {
      parentInfo.parent.children!.delete(parentInfo.name);
      this.emitWatch(normalized, 'rename');
    }
  }

  async rmdir(path: string): Promise<void> {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized);

    if (!node) {
      throw new FileNotFoundError(normalized, 'rmdir');
    }
    if (node.type !== 'directory') {
      throw new NotDirectoryError(normalized, 'rmdir');
    }
    if (node.children && node.children.size > 0) {
      throw new DirectoryNotEmptyError(normalized, 'rmdir');
    }

    const parentInfo = this.getParentAndName(normalized);
    if (parentInfo) {
      parentInfo.parent.children!.delete(parentInfo.name);
      this.emitWatch(normalized, 'rename');
    }
  }

  async unlink(path: string): Promise<void> {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized, false);

    if (!node) {
      throw new FileNotFoundError(normalized, 'unlink');
    }
    if (node.type === 'directory') {
      throw new IsDirectoryError(normalized, 'unlink');
    }

    const parentInfo = this.getParentAndName(normalized);
    if (parentInfo) {
      parentInfo.parent.children!.delete(parentInfo.name);
      this.emitWatch(normalized, 'rename');
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const normalizedOld = normalizePath(oldPath);
    const normalizedNew = normalizePath(newPath);

    const node = this.getNode(normalizedOld, false);
    if (!node) {
      throw new FileNotFoundError(normalizedOld, 'rename');
    }

    const oldParentInfo = this.getParentAndName(normalizedOld);
    const newParentInfo = this.getParentAndName(normalizedNew);

    if (!oldParentInfo || !newParentInfo) {
      throw new FileNotFoundError(dirname(normalizedNew), 'rename');
    }

    // Remove from old location
    oldParentInfo.parent.children!.delete(oldParentInfo.name);

    // Add to new location
    newParentInfo.parent.children!.set(newParentInfo.name, node);

    this.emitWatch(normalizedOld, 'rename');
    this.emitWatch(normalizedNew, 'rename');
  }

  async copyFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    const normalizedSrc = normalizePath(src);
    const normalizedDest = normalizePath(dest);

    const srcNode = this.getNode(normalizedSrc);
    if (!srcNode) {
      throw new FileNotFoundError(normalizedSrc, 'copyFile');
    }
    if (srcNode.type !== 'file') {
      throw new IsDirectoryError(normalizedSrc, 'copyFile');
    }

    const destParentInfo = this.getParentAndName(normalizedDest);
    if (!destParentInfo) {
      throw new FileNotFoundError(dirname(normalizedDest), 'copyFile');
    }

    const now = Date.now();
    destParentInfo.parent.children!.set(destParentInfo.name, {
      type: 'file',
      content: srcNode.content ? new Uint8Array(srcNode.content) : new Uint8Array(0),
      mode: srcNode.mode,
      mtime: now,
      ctime: now,
    });

    this.emitWatch(normalizedDest, 'rename');
  }

  async exists(path: string): Promise<boolean> {
    const normalized = normalizePath(path);
    return this.getNode(normalized) !== null;
  }

  async readlink(path: string): Promise<string> {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized, false);

    if (!node) {
      throw new FileNotFoundError(normalized, 'readlink');
    }
    if (node.type !== 'symlink' || !node.target) {
      throw new FileNotFoundError(normalized, 'readlink');
    }

    return node.target;
  }

  async symlink(target: string, path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    const parentInfo = this.getParentAndName(normalizedPath);

    if (!parentInfo) {
      throw new FileNotFoundError(dirname(normalizedPath), 'symlink');
    }

    const existing = parentInfo.parent.children?.get(parentInfo.name);
    if (existing) {
      throw new FileExistsError(normalizedPath, 'symlink');
    }

    const now = Date.now();
    parentInfo.parent.children!.set(parentInfo.name, {
      type: 'symlink',
      target,
      mode: 0o777,
      mtime: now,
      ctime: now,
    });

    this.emitWatch(normalizedPath, 'rename');
  }

  watch(path: string, callback: WatchCallback): FileWatcher {
    const normalized = normalizePath(path);

    if (!this.watchers.has(normalized)) {
      this.watchers.set(normalized, new Set());
    }
    this.watchers.get(normalized)!.add(callback);

    return {
      close: () => {
        const callbacks = this.watchers.get(normalized);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.watchers.delete(normalized);
          }
        }
      },
    };
  }

  async realpath(path: string): Promise<string> {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized, true);

    if (!node) {
      throw new FileNotFoundError(normalized, 'realpath');
    }

    // For in-memory fs, just return the normalized path
    return normalized;
  }

  /**
   * Clear all files and directories (for testing)
   */
  clear(): void {
    const now = Date.now();
    this.root = {
      type: 'directory',
      mode: 0o755,
      mtime: now,
      ctime: now,
      children: new Map(),
    };
    this.watchers.clear();
  }
}

/**
 * Create a new in-memory filesystem instance
 * @returns Memory filesystem
 */
export function createMemoryFS(): IFileSystem {
  return new MemoryFileSystem();
}
