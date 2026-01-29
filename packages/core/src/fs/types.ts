/**
 * File statistics interface
 */
export interface FileStat {
  /** Size in bytes */
  size: number;
  /** Last modified time (milliseconds since epoch) */
  mtime: number;
  /** Creation time (milliseconds since epoch) */
  ctime: number;
  /** True if this is a directory */
  isDirectory: boolean;
  /** True if this is a file */
  isFile: boolean;
  /** True if this is a symbolic link */
  isSymbolicLink: boolean;
  /** Unix file mode (permissions) */
  mode: number;
}

/**
 * Options for mkdir operation
 */
export interface MkdirOptions {
  /** Create parent directories if they don't exist */
  recursive?: boolean;
  /** Unix file mode for created directories */
  mode?: number;
}

/**
 * Options for rm operation
 */
export interface RmOptions {
  /** Remove directories and their contents recursively */
  recursive?: boolean;
  /** Don't throw if path doesn't exist */
  force?: boolean;
}

/**
 * Options for writeFile operation
 */
export interface WriteFileOptions {
  /** Unix file mode for created file */
  mode?: number;
  /** Encoding for string data (default: 'utf8') */
  encoding?: BufferEncoding;
}

/**
 * Options for readFile operation
 */
export interface ReadFileOptions {
  /** Encoding for returned data. If not specified, returns Uint8Array */
  encoding?: BufferEncoding;
}

/**
 * Directory entry returned by readdir with withFileTypes option
 */
export interface Dirent {
  /** Name of the entry (filename, not full path) */
  name: string;
  /** True if this is a directory */
  isDirectory(): boolean;
  /** True if this is a file */
  isFile(): boolean;
  /** True if this is a symbolic link */
  isSymbolicLink(): boolean;
}

/**
 * Options for readdir operation
 */
export interface ReaddirOptions {
  /** Include file type information */
  withFileTypes?: boolean;
  /** Recursively read directories */
  recursive?: boolean;
}

/**
 * Options for copy operation
 */
export interface CopyOptions {
  /** Copy directories recursively */
  recursive?: boolean;
  /** Overwrite existing files */
  force?: boolean;
  /** Don't throw if source doesn't exist */
  errorOnExist?: boolean;
}

/**
 * Watch event types
 */
export type WatchEventType = 'rename' | 'change';

/**
 * Watcher callback function
 */
export type WatchCallback = (eventType: WatchEventType, filename: string | null) => void;

/**
 * File watcher interface
 */
export interface FileWatcher {
  /** Stop watching */
  close(): void;
}

/**
 * Abstract filesystem interface
 *
 * This interface provides a unified API for filesystem operations that works
 * across different backends (browser IndexedDB, File System Access API, Node.js fs).
 *
 * All paths are absolute paths using forward slashes as separators.
 */
export interface IFileSystem {
  /**
   * Read a file's contents as a Uint8Array
   * @param path - Absolute path to the file
   * @throws Error if file doesn't exist or is a directory
   */
  readFile(path: string): Promise<Uint8Array>;

  /**
   * Read a file's contents as a string
   * @param path - Absolute path to the file
   * @param options - Read options including encoding
   * @throws Error if file doesn't exist or is a directory
   */
  readFile(path: string, options: ReadFileOptions & { encoding: BufferEncoding }): Promise<string>;

  /**
   * Write data to a file, creating it if it doesn't exist
   * @param path - Absolute path to the file
   * @param data - Content to write (string or binary)
   * @param options - Write options
   * @throws Error if parent directory doesn't exist
   */
  writeFile(path: string, data: Uint8Array | string, options?: WriteFileOptions): Promise<void>;

  /**
   * Read directory contents
   * @param path - Absolute path to the directory
   * @returns Array of filenames (not full paths)
   * @throws Error if directory doesn't exist
   */
  readdir(path: string): Promise<string[]>;

  /**
   * Read directory contents with file type information
   * @param path - Absolute path to the directory
   * @param options - Options including withFileTypes
   * @returns Array of Dirent objects
   * @throws Error if directory doesn't exist
   */
  readdir(path: string, options: ReaddirOptions & { withFileTypes: true }): Promise<Dirent[]>;

  /**
   * Get file or directory statistics
   * @param path - Absolute path to the file or directory
   * @throws Error if path doesn't exist
   */
  stat(path: string): Promise<FileStat>;

  /**
   * Get file or directory statistics, following symlinks
   * @param path - Absolute path to the file or directory
   * @throws Error if path doesn't exist
   */
  lstat(path: string): Promise<FileStat>;

  /**
   * Create a directory
   * @param path - Absolute path for the new directory
   * @param options - Options including recursive
   * @throws Error if directory exists or parent doesn't exist (without recursive)
   */
  mkdir(path: string, options?: MkdirOptions): Promise<void>;

  /**
   * Remove a file or directory
   * @param path - Absolute path to remove
   * @param options - Options including recursive and force
   * @throws Error if path doesn't exist (without force)
   */
  rm(path: string, options?: RmOptions): Promise<void>;

  /**
   * Remove an empty directory
   * @param path - Absolute path to the directory
   * @throws Error if directory doesn't exist or isn't empty
   */
  rmdir(path: string): Promise<void>;

  /**
   * Remove a file
   * @param path - Absolute path to the file
   * @throws Error if file doesn't exist or is a directory
   */
  unlink(path: string): Promise<void>;

  /**
   * Rename/move a file or directory
   * @param oldPath - Current path
   * @param newPath - New path
   * @throws Error if source doesn't exist
   */
  rename(oldPath: string, newPath: string): Promise<void>;

  /**
   * Copy a file or directory
   * @param src - Source path
   * @param dest - Destination path
   * @param options - Copy options
   */
  copyFile(src: string, dest: string, options?: CopyOptions): Promise<void>;

  /**
   * Check if a path exists
   * @param path - Absolute path to check
   * @returns true if path exists, false otherwise
   */
  exists(path: string): Promise<boolean>;

  /**
   * Read the target of a symbolic link
   * @param path - Absolute path to the symlink
   * @throws Error if path doesn't exist or isn't a symlink
   */
  readlink(path: string): Promise<string>;

  /**
   * Create a symbolic link
   * @param target - Path the symlink should point to
   * @param path - Path where symlink should be created
   */
  symlink(target: string, path: string): Promise<void>;

  /**
   * Watch a file or directory for changes
   * @param path - Path to watch
   * @param callback - Function called when changes occur
   * @returns Watcher that can be closed
   */
  watch(path: string, callback: WatchCallback): FileWatcher;

  /**
   * Get the real path (resolve symlinks)
   * @param path - Path to resolve
   */
  realpath(path: string): Promise<string>;
}

/**
 * Factory function type for creating filesystem instances
 */
export type FileSystemFactory = () => Promise<IFileSystem>;

/**
 * Configuration for filesystem backends
 */
export interface FileSystemConfig {
  /** Backend type */
  type: 'indexeddb' | 'memory' | 'opfs' | 'node';
  /** Database name for IndexedDB backend */
  dbName?: string;
  /** Root directory for node backend */
  rootDir?: string;
}
