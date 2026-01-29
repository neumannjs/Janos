<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useFileSystemStore } from '../stores/filesystem';
import { useGitStore } from '../stores/git';

const router = useRouter();
const authStore = useAuthStore();
const fsStore = useFileSystemStore();
const gitStore = useGitStore();

const repoUrl = ref('');
const currentFile = ref<string | null>(null);
const fileContent = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const isAuthenticated = computed(() => authStore.isAuthenticated);
const fileTree = computed(() => fsStore.fileTree);
const currentBranch = computed(() => gitStore.currentBranch);
const hasChanges = computed(() => gitStore.hasChanges);

onMounted(async () => {
  if (!isAuthenticated.value) {
    router.push('/');
    return;
  }

  await fsStore.initialize();
  await gitStore.initialize();

  // Try to load repository if already cloned
  if (await fsStore.exists(gitStore.repoPath)) {
    await loadRepo();
  }
});

async function cloneRepo() {
  if (!repoUrl.value) return;

  loading.value = true;
  error.value = null;

  try {
    await gitStore.clone(repoUrl.value, { depth: 1 });
    await loadRepo();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Clone failed';
  } finally {
    loading.value = false;
  }
}

async function loadRepo() {
  try {
    await fsStore.loadDirectory(gitStore.repoPath);
    await gitStore.refreshStatus();
    await gitStore.refreshBranches();
    await gitStore.loadCommits();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load repository';
  }
}

async function openFile(path: string) {
  loading.value = true;
  error.value = null;

  try {
    currentFile.value = path;
    fileContent.value = await fsStore.readFile(path);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to open file';
  } finally {
    loading.value = false;
  }
}

async function saveFile() {
  if (!currentFile.value) return;

  loading.value = true;
  error.value = null;

  try {
    await fsStore.writeFile(currentFile.value, fileContent.value);
    await gitStore.refreshStatus();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save file';
  } finally {
    loading.value = false;
  }
}

async function expandFolder(node: typeof fileTree.value[0]) {
  if (node.expanded) {
    fsStore.collapseNode(node);
  } else {
    await fsStore.expandNode(node);
  }
}

function getFileName(path: string): string {
  return path.split('/').pop() ?? path;
}
</script>

<template>
  <div class="editor">
    <header class="toolbar">
      <div class="toolbar-left">
        <router-link to="/" class="logo">Janos</router-link>
        <span v-if="currentBranch" class="branch">
          {{ currentBranch }}
        </span>
        <span v-if="hasChanges" class="changes-indicator">
          Modified
        </span>
      </div>
      <div class="toolbar-right">
        <button
          v-if="currentFile"
          class="btn btn-primary"
          @click="saveFile"
          :disabled="loading"
        >
          Save
        </button>
      </div>
    </header>

    <div class="workspace">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div v-if="!gitStore.isRepo" class="clone-form">
          <h3>Clone Repository</h3>
          <input
            v-model="repoUrl"
            type="text"
            placeholder="https://github.com/user/repo"
            @keyup.enter="cloneRepo"
          />
          <button
            class="btn btn-primary"
            @click="cloneRepo"
            :disabled="loading || !repoUrl"
          >
            {{ loading ? 'Cloning...' : 'Clone' }}
          </button>
        </div>

        <div v-else class="file-tree">
          <h3>Files</h3>
          <ul class="tree">
            <li
              v-for="node in fileTree"
              :key="node.path"
              class="tree-item"
            >
              <div
                class="tree-item-content"
                :class="{ directory: node.isDirectory, selected: currentFile === node.path }"
                @click="node.isDirectory ? expandFolder(node) : openFile(node.path)"
              >
                <span class="tree-icon">
                  {{ node.isDirectory ? (node.expanded ? '📂' : '📁') : '📄' }}
                </span>
                <span class="tree-name">{{ node.name }}</span>
              </div>
              <ul v-if="node.expanded && node.children" class="tree nested">
                <li
                  v-for="child in node.children"
                  :key="child.path"
                  class="tree-item"
                >
                  <div
                    class="tree-item-content"
                    :class="{ directory: child.isDirectory, selected: currentFile === child.path }"
                    @click="child.isDirectory ? expandFolder(child) : openFile(child.path)"
                  >
                    <span class="tree-icon">
                      {{ child.isDirectory ? '📁' : '📄' }}
                    </span>
                    <span class="tree-name">{{ child.name }}</span>
                  </div>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </aside>

      <!-- Editor pane -->
      <main class="editor-pane">
        <div v-if="error" class="error-banner">
          {{ error }}
        </div>

        <div v-if="!currentFile" class="no-file">
          <p>Select a file from the sidebar to edit</p>
        </div>

        <div v-else class="file-editor">
          <div class="file-header">
            <span class="file-name">{{ getFileName(currentFile) }}</span>
          </div>
          <textarea
            v-model="fileContent"
            class="editor-textarea"
            spellcheck="false"
          ></textarea>
        </div>
      </main>

      <!-- Git panel -->
      <aside class="git-panel">
        <h3>Git Status</h3>
        <div v-if="gitStore.stagedFiles.length > 0" class="status-section">
          <h4>Staged</h4>
          <ul class="status-list">
            <li v-for="file in gitStore.stagedFiles" :key="file.path">
              {{ getFileName(file.path) }}
              <span class="status-badge staged">{{ file.stagedStatus }}</span>
            </li>
          </ul>
        </div>
        <div v-if="gitStore.unstagedFiles.length > 0" class="status-section">
          <h4>Changes</h4>
          <ul class="status-list">
            <li v-for="file in gitStore.unstagedFiles" :key="file.path">
              {{ getFileName(file.path) }}
              <span class="status-badge modified">{{ file.workdirStatus }}</span>
            </li>
          </ul>
        </div>
        <div v-if="!hasChanges && gitStore.isRepo" class="no-changes">
          No uncommitted changes
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo {
  font-weight: bold;
  color: var(--color-primary);
  text-decoration: none;
}

.branch {
  padding: 0.25rem 0.5rem;
  background-color: var(--color-bg-tertiary);
  border-radius: 4px;
  font-size: 0.875rem;
}

.changes-indicator {
  padding: 0.25rem 0.5rem;
  background-color: var(--color-warning);
  color: black;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.workspace {
  flex: 1;
  display: grid;
  grid-template-columns: 250px 1fr 250px;
  overflow: hidden;
}

.sidebar {
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  padding: 1rem;
}

.clone-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.clone-form h3 {
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.clone-form input {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.file-tree h3 {
  font-size: 0.875rem;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.tree {
  list-style: none;
}

.tree.nested {
  padding-left: 1rem;
}

.tree-item-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
}

.tree-item-content:hover {
  background-color: var(--color-bg-tertiary);
}

.tree-item-content.selected {
  background-color: var(--color-primary);
}

.tree-icon {
  font-size: 0.875rem;
}

.tree-name {
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.editor-pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.error-banner {
  padding: 0.75rem 1rem;
  background-color: var(--color-error);
  color: white;
}

.no-file {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.file-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.file-header {
  padding: 0.5rem 1rem;
  background-color: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
}

.file-name {
  font-size: 0.875rem;
  font-weight: 500;
}

.editor-textarea {
  flex: 1;
  padding: 1rem;
  border: none;
  resize: none;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  background-color: var(--color-bg);
  color: var(--color-text);
}

.editor-textarea:focus {
  outline: none;
}

.git-panel {
  background-color: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border);
  overflow-y: auto;
  padding: 1rem;
}

.git-panel h3 {
  font-size: 0.875rem;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  margin-bottom: 1rem;
}

.status-section {
  margin-bottom: 1rem;
}

.status-section h4 {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.status-list {
  list-style: none;
}

.status-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
  font-size: 0.875rem;
}

.status-badge {
  padding: 0.125rem 0.25rem;
  border-radius: 2px;
  font-size: 0.625rem;
  text-transform: uppercase;
}

.status-badge.staged {
  background-color: var(--color-success);
  color: black;
}

.status-badge.modified {
  background-color: var(--color-warning);
  color: black;
}

.no-changes {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
}
</style>
