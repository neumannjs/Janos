<script setup lang="ts">
import { ref, onMounted, computed, provide } from 'vue';
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
import CloneDialog from '../components/dialogs/CloneDialog.vue';

const router = useRouter();
const authStore = useAuthStore();
const fsStore = useFileSystemStore();
const gitStore = useGitStore();
const uiStore = useUIStore();
const editorStore = useEditorStore();
const dialog = useDialog();

// Set up keyboard shortcuts
useKeyboardShortcuts();

const showCloneDialog = ref(false);
const cloneDialogRef = ref<InstanceType<typeof CloneDialog> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const repoLoaded = ref(false);

// Get configured repo from environment
const defaultGitHubUser = import.meta.env.VITE_GITHUB_USER ?? '';
const defaultGitHubRepo = import.meta.env.VITE_GITHUB_REPO ?? '';

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
  } else {
    // Show clone dialog if no repo exists
    showCloneDialog.value = true;
  }
});

async function handleClone(url: string): Promise<void> {
  if (!url) return;

  loading.value = true;
  cloneDialogRef.value?.setCloning(true);
  cloneDialogRef.value?.setError(null);
  cloneDialogRef.value?.setProgress(0);

  try {
    // TODO: Hook into git clone progress events
    cloneDialogRef.value?.setProgress(10);
    await gitStore.clone(url, { depth: 1 });
    cloneDialogRef.value?.setProgress(90);
    await loadRepo();
    cloneDialogRef.value?.setProgress(100);

    // Close dialog on success
    showCloneDialog.value = false;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Clone failed';
    cloneDialogRef.value?.setError(errorMsg);
    error.value = errorMsg;
  } finally {
    loading.value = false;
    cloneDialogRef.value?.setCloning(false);
  }
}

async function loadRepo(): Promise<void> {
  try {
    await fsStore.loadDirectory(gitStore.repoPath);
    await gitStore.refreshStatus();
    await gitStore.refreshBranches();
    await gitStore.loadCommits();
    repoLoaded.value = true;
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

// Allow opening clone dialog from elsewhere (e.g., welcome pane)
function openCloneDialog(): void {
  showCloneDialog.value = true;
}

// Provide context to child components
provide('editorView', { openCloneDialog, repoLoaded });

// Expose for child components
defineExpose({ openCloneDialog });
</script>

<template>
  <div class="editor-view">
    <!-- Main editor layout (always shown) -->
    <EditorLayout>
      <EditorPane @close-tab-request="handleCloseTabRequest" />
    </EditorLayout>

    <!-- Clone dialog -->
    <CloneDialog
      ref="cloneDialogRef"
      v-model:show="showCloneDialog"
      :default-user="defaultGitHubUser"
      :default-repo="defaultGitHubRepo"
      @clone="handleClone"
    />

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
</style>
