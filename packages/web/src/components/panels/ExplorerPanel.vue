<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { NTree, NDropdown, NButton, NEmpty, NIcon } from 'naive-ui';
import type { TreeOption } from 'naive-ui';
import {
  DocumentOutline,
  FolderOutline,
  FolderOpenOutline,
  RefreshOutline,
} from '@vicons/ionicons5';
import { useFileSystemStore, type FileTreeNode } from '../../stores/filesystem';
import { useEditorStore } from '../../stores/editor';
import { useGitStore } from '../../stores/git';

const fsStore = useFileSystemStore();
const editorStore = useEditorStore();
const gitStore = useGitStore();

const selectedKeys = ref<string[]>([]);
const expandedKeys = ref<string[]>([]);

// Context menu
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuNode = ref<FileTreeNode | null>(null);

// Inline rename
const renamingPath = ref<string | null>(null);
const renameValue = ref('');

// Convert FileTreeNode to Naive UI TreeOption
function nodeToTreeOption(node: FileTreeNode): TreeOption {
  const option: TreeOption = {
    key: node.path,
    label: node.name,
    isLeaf: !node.isDirectory,
    prefix: () =>
      h(NIcon, null, {
        default: () =>
          h(
            node.isDirectory
              ? expandedKeys.value.includes(node.path)
                ? FolderOpenOutline
                : FolderOutline
              : DocumentOutline
          ),
      }),
  };

  if (node.isDirectory && node.children && node.children.length > 0) {
    option.children = node.children.map(nodeToTreeOption);
  }

  return option;
}

const treeData = computed<TreeOption[]>(() => {
  return fsStore.fileTree.map(nodeToTreeOption);
});

// Handle node selection
function handleSelect(keys: string[]): void {
  selectedKeys.value = keys;
}

// Handle node click (open file)
function handleNodeClick(info: { option: TreeOption }): void {
  const path = info.option.key as string;
  const node = findNode(path);

  if (node && !node.isDirectory) {
    editorStore.openFile(path);
  }
}

// Handle expand/collapse
async function handleExpand(
  keys: string[],
  _option: Array<TreeOption | null>,
  meta: { node: TreeOption | null; action: 'expand' | 'collapse' | 'filter' }
): Promise<void> {
  expandedKeys.value = keys;

  if (meta.action === 'expand' && meta.node) {
    const path = meta.node.key as string;
    const node = findNode(path);
    if (node && node.isDirectory) {
      await fsStore.expandNode(node);
    }
  }
}

// Find node in tree by path
function findNode(path: string): FileTreeNode | null {
  function search(nodes: FileTreeNode[]): FileTreeNode | null {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = search(node.children);
        if (found) return found;
      }
    }
    return null;
  }
  return search(fsStore.fileTree);
}

// Context menu options
const contextMenuOptions = computed(() => {
  const node = contextMenuNode.value;
  const isDir = node?.isDirectory ?? false;

  const options = [];

  if (isDir) {
    options.push(
      { label: 'New File', key: 'new-file' },
      { label: 'New Folder', key: 'new-folder' },
      { type: 'divider', key: 'd1' }
    );
  }

  options.push(
    { label: 'Rename', key: 'rename' },
    { label: 'Delete', key: 'delete' }
  );

  if (!isDir) {
    options.push(
      { type: 'divider', key: 'd2' },
      { label: 'Copy Path', key: 'copy-path' }
    );
  }

  return options;
});

// Handle right-click
function handleContextMenu(info: { event: MouseEvent; option: TreeOption }): void {
  info.event.preventDefault();
  const path = info.option.key as string;
  const node = findNode(path);

  if (node) {
    contextMenuNode.value = node;
    contextMenuX.value = info.event.clientX;
    contextMenuY.value = info.event.clientY;
    showContextMenu.value = true;
  }
}

function hideContextMenu(): void {
  showContextMenu.value = false;
  contextMenuNode.value = null;
}

// Handle context menu action
async function handleContextMenuAction(key: string): Promise<void> {
  const node = contextMenuNode.value;
  hideContextMenu();

  if (!node) return;

  switch (key) {
    case 'new-file':
      // TODO: Show input dialog for filename
      break;
    case 'new-folder':
      // TODO: Show input dialog for folder name
      break;
    case 'rename':
      startRename(node);
      break;
    case 'delete':
      // TODO: Show confirmation dialog
      await fsStore.remove(node.path, { recursive: node.isDirectory });
      break;
    case 'copy-path':
      await navigator.clipboard.writeText(node.path);
      break;
  }
}

// Inline rename
function startRename(node: FileTreeNode): void {
  renamingPath.value = node.path;
  renameValue.value = node.name;
}

// Refresh tree
async function refresh(): Promise<void> {
  if (gitStore.isRepo) {
    await fsStore.loadDirectory(gitStore.repoPath);
  }
}
</script>

<template>
  <div class="explorer-panel">
    <div class="explorer-header">
      <span class="repo-name" v-if="gitStore.isRepo">
        {{ gitStore.repoPath.split('/').pop() }}
      </span>
      <div class="explorer-actions">
        <NButton quaternary size="tiny" @click="refresh" title="Refresh">
          <template #icon>
            <RefreshOutline />
          </template>
        </NButton>
      </div>
    </div>

    <div class="explorer-content">
      <NTree
        v-if="treeData.length > 0"
        :data="treeData"
        :selected-keys="selectedKeys"
        :expanded-keys="expandedKeys"
        selectable
        block-line
        expand-on-click
        @update:selected-keys="handleSelect"
        @update:expanded-keys="handleExpand"
        @node-props="({ option }) => ({
          onClick: () => handleNodeClick({ option }),
          onContextmenu: (e: MouseEvent) => handleContextMenu({ event: e, option }),
        })"
        class="file-tree"
      />

      <NEmpty
        v-else-if="!gitStore.isRepo"
        description="No repository loaded"
        class="empty-state"
      />

      <NEmpty
        v-else
        description="No files"
        class="empty-state"
      />
    </div>

    <!-- Context menu -->
    <NDropdown
      :show="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :options="contextMenuOptions"
      placement="bottom-start"
      trigger="manual"
      @select="handleContextMenuAction"
      @clickoutside="hideContextMenu"
    />
  </div>
</template>

<style scoped>
.explorer-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.explorer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.repo-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.explorer-actions {
  display: flex;
  gap: 4px;
}

.explorer-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.file-tree {
  --n-node-text-color: var(--color-text-secondary);
}

.file-tree :deep(.n-tree-node-content) {
  padding: 4px 8px;
}

.file-tree :deep(.n-tree-node-content__prefix) {
  margin-right: 6px;
}

.file-tree :deep(.n-tree-node--selected > .n-tree-node-content) {
  background-color: rgba(233, 69, 96, 0.15);
}

.empty-state {
  padding: 32px 16px;
}
</style>
