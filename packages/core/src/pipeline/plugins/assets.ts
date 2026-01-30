/**
 * Assets plugin
 *
 * Copies static asset files from source directories to the output.
 * Similar to metalsmith-assets.
 *
 * Used for copying CSS, images, fonts, and other static files that
 * don't need processing by the pipeline.
 */
import type { PipelinePlugin, VirtualFileMap, PipelineContext, VirtualFile } from '../types.js';

/**
 * Options for a single asset source
 */
export interface AssetSource {
  /** Source directory to copy from */
  source: string;
  /** Destination directory to copy to (default: '/') */
  destination?: string;
}

/**
 * Options for assets plugin
 */
export interface AssetsOptions {
  /** Array of asset sources to copy */
  sources?: AssetSource[];
  /** Single source (shorthand when only one source needed) */
  source?: string;
  /** Single destination (shorthand when only one source needed) */
  destination?: string;
}

/**
 * Normalize path - remove leading/trailing slashes and ensure consistency
 */
function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

/**
 * Join paths, handling empty strings and slashes
 */
function joinPaths(...parts: string[]): string {
  return parts
    .map(normalizePath)
    .filter(p => p.length > 0)
    .join('/');
}

/**
 * Check if a path starts with a prefix (directory matching)
 */
function pathStartsWith(path: string, prefix: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedPrefix = normalizePath(prefix);

  if (normalizedPrefix === '') {
    return true;
  }

  return normalizedPath === normalizedPrefix ||
         normalizedPath.startsWith(normalizedPrefix + '/');
}

/**
 * Get the relative path after removing a prefix
 */
function getRelativePath(path: string, prefix: string): string {
  const normalizedPath = normalizePath(path);
  const normalizedPrefix = normalizePath(prefix);

  if (normalizedPrefix === '') {
    return normalizedPath;
  }

  if (normalizedPath === normalizedPrefix) {
    return '';
  }

  if (normalizedPath.startsWith(normalizedPrefix + '/')) {
    return normalizedPath.slice(normalizedPrefix.length + 1);
  }

  return normalizedPath;
}

/**
 * Create the assets plugin
 * @param options - Plugin options
 * @returns Pipeline plugin
 */
export function assets(options: AssetsOptions = {}): PipelinePlugin {
  // Build list of sources
  const sources: AssetSource[] = [];

  if (options.sources) {
    sources.push(...options.sources);
  }

  if (options.source) {
    sources.push({
      source: options.source,
      destination: options.destination ?? '/',
    });
  }

  return async function assetsPlugin(
    files: VirtualFileMap,
    context: PipelineContext
  ): Promise<void> {
    if (sources.length === 0) {
      context.log('assets: no sources configured', 'warn');
      return;
    }

    let copiedCount = 0;

    for (const { source, destination = '/' } of sources) {
      const normalizedSource = normalizePath(source);
      const normalizedDest = normalizePath(destination);

      // Find all files in the source directory
      const filesToCopy: Array<{ path: string; file: VirtualFile }> = [];

      for (const [path, file] of files) {
        if (pathStartsWith(path, normalizedSource)) {
          filesToCopy.push({ path, file });
        }
      }

      if (filesToCopy.length === 0) {
        context.log(`assets: no files found in '${source}'`, 'debug');
        continue;
      }

      // Copy files to destination
      for (const { path, file } of filesToCopy) {
        const relativePath = getRelativePath(path, normalizedSource);
        const destPath = joinPaths(normalizedDest, relativePath);

        if (destPath === '') {
          continue;
        }

        // Create a copy of the file at the new path
        const copiedFile: VirtualFile = {
          path: destPath,
          contents: file.contents,
          metadata: { ...file.metadata },
          sourcePath: file.sourcePath ?? path,
        };

        files.set(destPath, copiedFile);
        copiedCount++;

        context.log(`assets: copied ${path} -> ${destPath}`, 'debug');
      }

      context.log(
        `assets: copied ${filesToCopy.length} files from '${source}' to '${destination}'`,
        'info'
      );
    }

    if (copiedCount > 0) {
      context.log(`assets: copied ${copiedCount} total files`, 'info');
    }
  };
}

export default assets;
