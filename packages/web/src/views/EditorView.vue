<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useFileSystemStore } from '../stores/filesystem';
import { useGitStore } from '../stores/git';
import { useUIStore } from '../stores/ui';
import { useEditorStore } from '../stores/editor';
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts';
import { useDialog } from '../composables/useDialog';
import EditorLayout from '../components/layout/EditorLayout.vue';
import EditorPane from '../components/editor/EditorPane.vue';
import ConfirmDialog from '../components/dialogs/ConfirmDialog.vue';
import InputDialog from '../components/dialogs/InputDialog.vue';

const router = useRouter();
const authStore = useAuthStore();
const fsStore = useFileSystemStore();
const gitStore = useGitStore();
const uiStore = useUIStore();
const editorStore = useEditorStore();
const dialog = useDialog();

// Set up keyboard shortcuts
useKeyboardShortcuts();

const repoUrl = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const isAuthenticated = computed(() => authStore.isAuthenticated);

onMounted(async () => {
  if (!isAuthenticated.value) {
    router.push('/');
    return;
  }

  // Set up resize listener for responsive behavior
  uiStore.setupResizeListener();

  // Initialize stores
  await fsStore.initialize();
  await gitStore.initialize();

  // Try to load repository if already cloned
  if (await fsStore.exists(gitStore.repoPath)) {
    await loadRepo();
  }
});

async function cloneRepo(): Promise<void> {
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

async function loadRepo(): Promise<void> {
  try {
    await fsStore.loadDirectory(gitStore.repoPath);
    await gitStore.refreshStatus();
    await gitStore.refreshBranches();
    await gitStore.loadCommits();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load repository';
  }
}

// Handle tab close with unsaved changes
async function handleCloseTabRequest(tabId: string): Promise<void> {
  const confirmed = await dialog.confirmDiscard();
  if (confirmed) {
    editorStore.forceCloseTab(tabId);
  }
}
</script>

<template>
  <div class="editor-view">
    <!-- Clone repository prompt if no repo loaded -->
    <div v-if="!gitStore.isRepo" class="clone-overlay">
      <div class="clone-card">
        <h2>Clone Repository</h2>
        <p>Enter the URL of a GitHub repository to get started.</p>

        <div class="clone-form">
          <input
            v-model="repoUrl"
            type="text"
            placeholder="https://github.com/user/repo"
            @keyup.enter="cloneRepo"
            :disabled="loading"
          />
          <button
            class="btn btn-primary"
            @click="cloneRepo"
            :disabled="loading || !repoUrl"
          >
            {{ loading ? 'Cloning...' : 'Clone' }}
          </button>
        </div>

        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
    </div>

    <!-- Main editor layout -->
    <EditorLayout v-else>
      <EditorPane @close-tab-request="handleCloseTabRequest" />
    </EditorLayout>

    <!-- Global dialogs -->
    <ConfirmDialog />
    <InputDialog />
  </div>
</template>

<style scoped>
.editor-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.clone-overlay {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg);
  padding: 20px;
}

.clone-card {
  max-width: 480px;
  width: 100%;
  padding: 32px;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  text-align: center;
}

.clone-card h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
}

.clone-card p {
  color: var(--color-text-secondary);
  margin-bottom: 24px;
}

.clone-form {
  display: flex;
  gap: 12px;
}

.clone-form input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: 14px;
}

.clone-form input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.clone-form input:disabled {
  opacity: 0.6;
}

.error-message {
  margin-top: 16px;
  color: var(--color-error);
  font-size: 14px;
}

.btn {
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
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
