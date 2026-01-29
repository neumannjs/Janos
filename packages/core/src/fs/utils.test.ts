import { describe, it, expect } from 'vitest';
import {
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

describe('normalizePath', () => {
  it('should handle root path', () => {
    expect(normalizePath('/')).toBe('/');
  });

  it('should remove trailing slashes', () => {
    expect(normalizePath('/foo/bar/')).toBe('/foo/bar');
    expect(normalizePath('/foo/bar///')).toBe('/foo/bar');
  });

  it('should resolve . segments', () => {
    expect(normalizePath('/foo/./bar')).toBe('/foo/bar');
    expect(normalizePath('/./foo/bar')).toBe('/foo/bar');
  });

  it('should resolve .. segments', () => {
    expect(normalizePath('/foo/bar/../baz')).toBe('/foo/baz');
    expect(normalizePath('/foo/../bar')).toBe('/bar');
    expect(normalizePath('/foo/../../bar')).toBe('/bar');
  });

  it('should convert backslashes to forward slashes', () => {
    expect(normalizePath('\\foo\\bar')).toBe('/foo/bar');
    expect(normalizePath('/foo\\bar/baz')).toBe('/foo/bar/baz');
  });
});

describe('joinPath', () => {
  it('should join simple paths', () => {
    expect(joinPath('/foo', 'bar')).toBe('/foo/bar');
    expect(joinPath('/foo', 'bar', 'baz')).toBe('/foo/bar/baz');
  });

  it('should handle absolute segments', () => {
    expect(joinPath('/foo', '/bar')).toBe('/bar');
    expect(joinPath('/foo', 'bar', '/baz')).toBe('/baz');
  });

  it('should handle empty segments', () => {
    expect(joinPath('/foo', '', 'bar')).toBe('/foo/bar');
  });

  it('should handle trailing slashes', () => {
    expect(joinPath('/foo/', 'bar')).toBe('/foo/bar');
  });
});

describe('dirname', () => {
  it('should return parent directory', () => {
    expect(dirname('/foo/bar/baz.txt')).toBe('/foo/bar');
    expect(dirname('/foo/bar')).toBe('/foo');
  });

  it('should return root for top-level paths', () => {
    expect(dirname('/foo')).toBe('/');
  });

  it('should return . for relative paths without directory', () => {
    expect(dirname('foo.txt')).toBe('.');
  });
});

describe('basename', () => {
  it('should return filename', () => {
    expect(basename('/foo/bar/baz.txt')).toBe('baz.txt');
    expect(basename('/foo/bar')).toBe('bar');
  });

  it('should remove extension when specified', () => {
    expect(basename('/foo/bar.txt', '.txt')).toBe('bar');
    expect(basename('/foo/bar.test.txt', '.txt')).toBe('bar.test');
  });
});

describe('extname', () => {
  it('should return extension with dot', () => {
    expect(extname('/foo/bar.txt')).toBe('.txt');
    expect(extname('/foo/bar.test.js')).toBe('.js');
  });

  it('should return empty string for no extension', () => {
    expect(extname('/foo/bar')).toBe('');
    expect(extname('/foo/.gitignore')).toBe('');
  });
});

describe('isAbsolute', () => {
  it('should return true for absolute paths', () => {
    expect(isAbsolute('/foo/bar')).toBe(true);
    expect(isAbsolute('/')).toBe(true);
  });

  it('should return false for relative paths', () => {
    expect(isAbsolute('foo/bar')).toBe(false);
    expect(isAbsolute('./foo')).toBe(false);
    expect(isAbsolute('../foo')).toBe(false);
  });
});

describe('relative', () => {
  it('should compute relative path', () => {
    expect(relative('/foo/bar', '/foo/baz')).toBe('../baz');
    expect(relative('/foo/bar', '/foo/bar/baz')).toBe('baz');
    expect(relative('/foo/bar/baz', '/foo')).toBe('../..');
  });

  it('should return . for same path', () => {
    expect(relative('/foo/bar', '/foo/bar')).toBe('.');
  });
});

describe('parsePath', () => {
  it('should parse path components', () => {
    const result = parsePath('/foo/bar/baz.txt');
    expect(result.root).toBe('/');
    expect(result.dir).toBe('/foo/bar');
    expect(result.base).toBe('baz.txt');
    expect(result.ext).toBe('.txt');
    expect(result.name).toBe('baz');
  });

  it('should handle paths without extension', () => {
    const result = parsePath('/foo/bar');
    expect(result.base).toBe('bar');
    expect(result.ext).toBe('');
    expect(result.name).toBe('bar');
  });
});

describe('string/bytes conversion', () => {
  it('should convert string to bytes and back', () => {
    const original = 'Hello, World! 🌍';
    const bytes = stringToBytes(original);
    const result = bytesToString(bytes);
    expect(result).toBe(original);
  });

  it('should convert bytes to base64 and back', () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64]);
    const base64 = bytesToBase64(original);
    const result = base64ToBytes(base64);
    expect(result).toEqual(original);
  });
});
