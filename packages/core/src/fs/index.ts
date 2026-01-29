/**
 * Filesystem module
 *
 * Provides abstract filesystem interface with multiple backend implementations.
 */

// Types
export type {
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
  WatchEventType,
  FileWatcher,
  FileSystemFactory,
  FileSystemConfig,
} from './types.js';

// Errors
export {
  FileSystemError,
  FileNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionDeniedError,
  InvalidArgumentError,
  mapError,
  isFileSystemError,
  isErrorCode,
} from './errors.js';

// Utilities
export {
  normalizePath,
  joinPath,
  dirname,
  basename,
  extname,
  isAbsolute,
  relative,
  parsePath,
  stringToBytes,
  bytesToString,
  bytesToBase64,
  base64ToBytes,
} from './utils.js';

// Implementations
export { ZenFSFileSystem, createZenFS, type ZenFSOptions } from './zenfs.js';
export { MemoryFileSystem, createMemoryFS } from './memory.js';
