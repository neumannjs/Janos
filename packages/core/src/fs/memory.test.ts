import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryFileSystem } from './memory.js';
import {
  FileNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
} from './errors.js';

describe('MemoryFileSystem', () => {
  let fs: MemoryFileSystem;

  beforeEach(() => {
    fs = new MemoryFileSystem();
  });

  describe('writeFile and readFile', () => {
    it('should write and read a string file', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/hello.txt', 'Hello, World!');
      const content = await fs.readFile('/test/hello.txt', { encoding: 'utf8' });
      expect(content).toBe('Hello, World!');
    });

    it('should write and read a binary file', async () => {
      await fs.mkdir('/test');
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      await fs.writeFile('/test/data.bin', data);
      const content = await fs.readFile('/test/data.bin');
      expect(content).toEqual(data);
    });

    it('should throw FileNotFoundError for non-existent file', async () => {
      await expect(fs.readFile('/nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw FileNotFoundError when parent directory does not exist', async () => {
      await expect(fs.writeFile('/nonexistent/file.txt', 'test')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw IsDirectoryError when reading a directory', async () => {
      await fs.mkdir('/test');
      await expect(fs.readFile('/test')).rejects.toThrow(IsDirectoryError);
    });

    it('should overwrite existing file', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/file.txt', 'first');
      await fs.writeFile('/test/file.txt', 'second');
      const content = await fs.readFile('/test/file.txt', { encoding: 'utf8' });
      expect(content).toBe('second');
    });
  });

  describe('mkdir', () => {
    it('should create a directory', async () => {
      await fs.mkdir('/test');
      const stat = await fs.stat('/test');
      expect(stat.isDirectory).toBe(true);
    });

    it('should create nested directories with recursive option', async () => {
      await fs.mkdir('/a/b/c', { recursive: true });
      const stat = await fs.stat('/a/b/c');
      expect(stat.isDirectory).toBe(true);
    });

    it('should throw FileExistsError for existing directory without recursive', async () => {
      await fs.mkdir('/test');
      await expect(fs.mkdir('/test')).rejects.toThrow(FileExistsError);
    });

    it('should not throw for existing directory with recursive', async () => {
      await fs.mkdir('/test');
      await expect(fs.mkdir('/test', { recursive: true })).resolves.not.toThrow();
    });

    it('should throw FileNotFoundError when parent does not exist', async () => {
      await expect(fs.mkdir('/nonexistent/test')).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('readdir', () => {
    it('should list directory contents', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/a.txt', 'a');
      await fs.writeFile('/test/b.txt', 'b');
      await fs.mkdir('/test/subdir');

      const entries = await fs.readdir('/test');
      expect(entries).toHaveLength(3);
      expect(entries).toContain('a.txt');
      expect(entries).toContain('b.txt');
      expect(entries).toContain('subdir');
    });

    it('should return Dirent objects with withFileTypes option', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/file.txt', 'content');
      await fs.mkdir('/test/dir');

      const entries = await fs.readdir('/test', { withFileTypes: true });
      expect(entries).toHaveLength(2);

      const file = entries.find((e) => e.name === 'file.txt');
      const dir = entries.find((e) => e.name === 'dir');

      expect(file?.isFile()).toBe(true);
      expect(file?.isDirectory()).toBe(false);
      expect(dir?.isFile()).toBe(false);
      expect(dir?.isDirectory()).toBe(true);
    });

    it('should throw FileNotFoundError for non-existent directory', async () => {
      await expect(fs.readdir('/nonexistent')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw NotDirectoryError for file', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/file.txt', 'content');
      await expect(fs.readdir('/test/file.txt')).rejects.toThrow(NotDirectoryError);
    });
  });

  describe('stat', () => {
    it('should return stats for a file', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/file.txt', 'hello');

      const stat = await fs.stat('/test/file.txt');
      expect(stat.isFile).toBe(true);
      expect(stat.isDirectory).toBe(false);
      expect(stat.size).toBe(5);
    });

    it('should return stats for a directory', async () => {
      await fs.mkdir('/test');

      const stat = await fs.stat('/test');
      expect(stat.isFile).toBe(false);
      expect(stat.isDirectory).toBe(true);
    });

    it('should throw FileNotFoundError for non-existent path', async () => {
      await expect(fs.stat('/nonexistent')).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('unlink', () => {
    it('should delete a file', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/file.txt', 'content');
      await fs.unlink('/test/file.txt');
      await expect(fs.stat('/test/file.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw FileNotFoundError for non-existent file', async () => {
      await expect(fs.unlink('/nonexistent.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw IsDirectoryError for directory', async () => {
      await fs.mkdir('/test');
      await expect(fs.unlink('/test')).rejects.toThrow(IsDirectoryError);
    });
  });

  describe('rmdir', () => {
    it('should remove an empty directory', async () => {
      await fs.mkdir('/test');
      await fs.rmdir('/test');
      await expect(fs.stat('/test')).rejects.toThrow(FileNotFoundError);
    });

    it('should throw DirectoryNotEmptyError for non-empty directory', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/file.txt', 'content');
      await expect(fs.rmdir('/test')).rejects.toThrow(DirectoryNotEmptyError);
    });

    it('should throw FileNotFoundError for non-existent directory', async () => {
      await expect(fs.rmdir('/nonexistent')).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('rm', () => {
    it('should remove a file', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/file.txt', 'content');
      await fs.rm('/test/file.txt');
      await expect(fs.stat('/test/file.txt')).rejects.toThrow(FileNotFoundError);
    });

    it('should remove directory recursively', async () => {
      await fs.mkdir('/test/subdir', { recursive: true });
      await fs.writeFile('/test/file.txt', 'content');
      await fs.writeFile('/test/subdir/nested.txt', 'nested');

      await fs.rm('/test', { recursive: true });
      await expect(fs.stat('/test')).rejects.toThrow(FileNotFoundError);
    });

    it('should not throw with force option for non-existent path', async () => {
      await expect(fs.rm('/nonexistent', { force: true })).resolves.not.toThrow();
    });
  });

  describe('rename', () => {
    it('should rename a file', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/old.txt', 'content');
      await fs.rename('/test/old.txt', '/test/new.txt');

      await expect(fs.stat('/test/old.txt')).rejects.toThrow(FileNotFoundError);
      const content = await fs.readFile('/test/new.txt', { encoding: 'utf8' });
      expect(content).toBe('content');
    });

    it('should move a file to different directory', async () => {
      await fs.mkdir('/src');
      await fs.mkdir('/dest');
      await fs.writeFile('/src/file.txt', 'content');
      await fs.rename('/src/file.txt', '/dest/file.txt');

      await expect(fs.stat('/src/file.txt')).rejects.toThrow(FileNotFoundError);
      const content = await fs.readFile('/dest/file.txt', { encoding: 'utf8' });
      expect(content).toBe('content');
    });
  });

  describe('copyFile', () => {
    it('should copy a file', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/source.txt', 'content');
      await fs.copyFile('/test/source.txt', '/test/dest.txt');

      const srcContent = await fs.readFile('/test/source.txt', { encoding: 'utf8' });
      const destContent = await fs.readFile('/test/dest.txt', { encoding: 'utf8' });
      expect(srcContent).toBe('content');
      expect(destContent).toBe('content');
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/file.txt', 'content');
      expect(await fs.exists('/test/file.txt')).toBe(true);
    });

    it('should return true for existing directory', async () => {
      await fs.mkdir('/test');
      expect(await fs.exists('/test')).toBe(true);
    });

    it('should return false for non-existent path', async () => {
      expect(await fs.exists('/nonexistent')).toBe(false);
    });
  });

  describe('symlink and readlink', () => {
    it('should create and read symlinks', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/target.txt', 'content');
      await fs.symlink('/test/target.txt', '/test/link.txt');

      const target = await fs.readlink('/test/link.txt');
      expect(target).toBe('/test/target.txt');
    });

    it('should follow symlinks in stat', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/target.txt', 'hello');
      await fs.symlink('/test/target.txt', '/test/link.txt');

      const stat = await fs.stat('/test/link.txt');
      expect(stat.isFile).toBe(true);
      expect(stat.size).toBe(5);
    });

    it('should not follow symlinks in lstat', async () => {
      await fs.mkdir('/test');
      await fs.writeFile('/test/target.txt', 'hello');
      await fs.symlink('/test/target.txt', '/test/link.txt');

      const stat = await fs.lstat('/test/link.txt');
      expect(stat.isSymbolicLink).toBe(true);
    });
  });

  describe('watch', () => {
    it('should notify on file changes', async () => {
      await fs.mkdir('/test');

      const events: Array<{ type: string; filename: string | null }> = [];
      const watcher = fs.watch('/test', (eventType, filename) => {
        events.push({ type: eventType, filename });
      });

      await fs.writeFile('/test/file.txt', 'content');

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.filename).toBe('file.txt');

      watcher.close();
    });
  });

  describe('clear', () => {
    it('should clear all files and directories', async () => {
      await fs.mkdir('/test/subdir', { recursive: true });
      await fs.writeFile('/test/file.txt', 'content');

      fs.clear();

      await expect(fs.stat('/test')).rejects.toThrow(FileNotFoundError);
    });
  });
});
