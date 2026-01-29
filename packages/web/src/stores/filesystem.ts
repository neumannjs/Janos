import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import {
  createZenFS,
  type IFileSystem,
  type FileStat,
} from '@janos/core';

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
  expanded?: boolean;
}

export const useFileSystemStore = defineStore('filesystem', () => {
  // State
  const fs = shallowRef<IFileSystem | null>(null);
  const initialized = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const fileTree = ref<FileTreeNode[]>([]);
  const currentPath = ref<string>('/');

  // Initialize filesystem
  async function initialize(): Promise<void> {
    if (initialized.value) return;

    loading.value = true;
    error.value = null;

    try {
      fs.value = await createZenFS({ dbName: 'janos-fs' });
      initialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize filesystem';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Build file tree from a directory
  async function buildTree(path: string): Promise<FileTreeNode[]> {
    if (!fs.value) {
      throw new Error('Filesystem not initialized');
    }

    const entries = await fs.value.readdir(path, { withFileTypes: true });
    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      const fullPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
      const node: FileTreeNode = {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
      };

      if (node.isDirectory) {
        node.children = [];
        node.expanded = false;
      }

      nodes.push(node);
    }

    // Sort: directories first, then alphabetically
    nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return nodes;
  }

  // Load directory contents
  async function loadDirectory(path: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      fileTree.value = await buildTree(path);
      currentPath.value = path;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load directory';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Expand a directory node in the tree
  async function expandNode(node: FileTreeNode): Promise<void> {
    if (!node.isDirectory || !fs.value) return;

    try {
      node.children = await buildTree(node.path);
      node.expanded = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to expand directory';
    }
  }

  // Collapse a directory node
  function collapseNode(node: FileTreeNode): void {
    if (!node.isDirectory) return;
    node.expanded = false;
    node.children = [];
  }

  // Read file contents
  async function readFile(path: string): Promise<string> {
    if (!fs.value) {
      throw new Error('Filesystem not initialized');
    }

    const content = await fs.value.readFile(path, { encoding: 'utf8' });
    return content;
  }

  // Write file contents
  async function writeFile(path: string, content: string): Promise<void> {
    if (!fs.value) {
      throw new Error('Filesystem not initialized');
    }

    await fs.value.writeFile(path, content);
  }

  // Get file stats
  async function stat(path: string): Promise<FileStat> {
    if (!fs.value) {
      throw new Error('Filesystem not initialized');
    }

    return await fs.value.stat(path);
  }

  // Create directory
  async function mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (!fs.value) {
      throw new Error('Filesystem not initialized');
    }

    await fs.value.mkdir(path, options);
    await loadDirectory(currentPath.value);
  }

  // Delete file or directory
  async function remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (!fs.value) {
      throw new Error('Filesystem not initialized');
    }

    await fs.value.rm(path, options);
    await loadDirectory(currentPath.value);
  }

  // Rename/move file or directory
  async function rename(oldPath: string, newPath: string): Promise<void> {
    if (!fs.value) {
      throw new Error('Filesystem not initialized');
    }

    await fs.value.rename(oldPath, newPath);
    await loadDirectory(currentPath.value);
  }

  // Check if path exists
  async function exists(path: string): Promise<boolean> {
    if (!fs.value) return false;
    return await fs.value.exists(path);
  }

  return {
    // State
    fs,
    initialized,
    loading,
    error,
    fileTree,
    currentPath,

    // Actions
    initialize,
    loadDirectory,
    expandNode,
    collapseNode,
    readFile,
    writeFile,
    stat,
    mkdir,
    remove,
    rename,
    exists,
  };
});
