/**
 * Build script using JSON configuration
 *
 * This script demonstrates building a site from janos.config.json.
 * Run with: npx tsx src/pipeline/build-from-config.ts <config-file> <site-root> <output-dir>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, createPipelineFromConfig, type JsonConfig } from './config.js';
import type { VirtualFile, VirtualFileMap } from './types.js';

/**
 * Recursively read all files from a directory
 */
function readDirRecursive(dir: string, baseDir: string = dir): Array<{ relativePath: string; absolutePath: string }> {
  const results: Array<{ relativePath: string; absolutePath: string }> = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, absolutePath);

    if (entry.isDirectory()) {
      // Skip hidden directories and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      results.push(...readDirRecursive(absolutePath, baseDir));
    } else {
      results.push({ relativePath, absolutePath });
    }
  }

  return results;
}

/**
 * Load files into virtual file map
 */
function loadFiles(rootDir: string, subDir: string): VirtualFileMap {
  const files: VirtualFileMap = new Map();
  const fullPath = path.join(rootDir, subDir);

  if (!fs.existsSync(fullPath)) {
    console.log(`Directory not found: ${fullPath}`);
    return files;
  }

  const entries = readDirRecursive(fullPath, rootDir);

  for (const { relativePath, absolutePath } of entries) {
    const contents = fs.readFileSync(absolutePath);
    const file: VirtualFile = {
      path: relativePath,
      contents: new Uint8Array(contents),
      metadata: {},
      sourcePath: relativePath,
    };
    files.set(relativePath, file);
  }

  return files;
}

/**
 * Write virtual files to disk
 */
function writeFiles(files: VirtualFileMap, outputDir: string, skipPrefixes: string[]): number {
  fs.mkdirSync(outputDir, { recursive: true });

  let count = 0;
  for (const [filePath, file] of files) {
    // Skip source files
    if (skipPrefixes.some(prefix => filePath.startsWith(prefix))) {
      continue;
    }

    const outputPath = path.join(outputDir, filePath);
    const dir = path.dirname(outputPath);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, file.contents);
    count++;
  }

  return count;
}

/**
 * Build site from config
 */
async function build(configPath: string, siteRoot: string, outputDir: string) {
  console.log('Building site from config...\n');
  console.log(`Config: ${configPath}`);
  console.log(`Site root: ${siteRoot}`);
  console.log(`Output: ${outputDir}\n`);

  // Load and parse config
  const configJson = fs.readFileSync(configPath, 'utf-8');
  const config: JsonConfig = JSON.parse(configJson);

  // Create pipeline from config
  const pipeline = createPipelineFromConfig(config);
  const context = pipeline.getContext();

  // Load source files
  console.log('Loading source files...');
  const files: VirtualFileMap = new Map();

  const sourceDir = config.site.sourceDir ?? '_src';
  const layoutsDir = config.site.layoutsDir ?? '_layouts';

  const srcFiles = loadFiles(siteRoot, sourceDir);
  for (const [p, file] of srcFiles) {
    files.set(p, file);
  }
  console.log(`  Loaded ${srcFiles.size} source files from ${sourceDir}/`);

  const layoutFiles = loadFiles(siteRoot, layoutsDir);
  for (const [p, file] of layoutFiles) {
    files.set(p, file);
  }
  console.log(`  Loaded ${layoutFiles.size} layout files from ${layoutsDir}/`);

  // Run the pipeline
  console.log('\nRunning pipeline...');
  const startTime = Date.now();

  try {
    const result = await pipeline.process(files);
    const duration = Date.now() - startTime;

    console.log(`\nPipeline completed in ${duration}ms`);
    console.log(`Total files: ${result.size}`);

    // Count file types
    const counts: Record<string, number> = {};
    for (const [filePath] of result) {
      const ext = path.extname(filePath) || '(no ext)';
      counts[ext] = (counts[ext] || 0) + 1;
    }
    console.log('\nFile types:');
    for (const [ext, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${ext}: ${count}`);
    }

    // Clean output directory before writing
    console.log(`\nCleaning output directory ${outputDir}...`);
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
    }

    // Write output
    console.log(`Writing output to ${outputDir}...`);
    const skipPrefixes = [sourceDir + '/', layoutsDir + '/'];
    const outputCount = writeFiles(result, outputDir, skipPrefixes);
    console.log(`Wrote ${outputCount} files`);

  } catch (error) {
    console.error('\nBuild failed:', error);
    process.exit(1);
  }
}

// CLI entry point
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('Usage: npx tsx build-from-config.ts <config-file> <site-root> <output-dir>');
  console.log('\nExample:');
  console.log('  npx tsx build-from-config.ts ./examples/gijsvandam.config.json /path/to/site ./output');
  process.exit(1);
}

const [configPath, siteRoot, outputDir] = args;

build(
  path.resolve(configPath),
  path.resolve(siteRoot),
  path.resolve(outputDir)
);
