<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { NModal, NCard, NButton, NSpace } from 'naive-ui';
import { useUIStore } from '../../stores/ui';
import { useEditorStore } from '../../stores/editor';
import { useNotificationsStore } from '../../stores/notifications';
import ActivityBar from './ActivityBar.vue';
import SidePanel from './SidePanel.vue';
import TabBar from './TabBar.vue';
import StatusBar from './StatusBar.vue';

const uiStore = useUIStore();
const editorStore = useEditorStore();
const notificationsStore = useNotificationsStore();

const sidePanelWidth = computed(() =>
  uiStore.sidePanelCollapsed ? '0px' : '250px'
);

// Unsaved changes modal state
const showUnsavedModal = ref(false);
const pendingCloseTabId = ref<string | null>(null);
const pendingCloseTabName = ref('');

function handleCloseTabRequest(tabId: string): void {
  const tab = editorStore.tabs.find((t) => t.id === tabId);
  if (tab) {
    pendingCloseTabId.value = tabId;
    pendingCloseTabName.value = tab.name;
    showUnsavedModal.value = true;
  }
}

async function handleSaveAndClose(): Promise<void> {
  if (pendingCloseTabId.value) {
    try {
      await editorStore.saveTab(pendingCloseTabId.value);
      notificationsStore.success('Saved', `${pendingCloseTabName.value} saved`);
      editorStore.forceCloseTab(pendingCloseTabId.value);
    } catch (err) {
      notificationsStore.error(
        'Save Failed',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }
  closeModal();
}

function handleDiscardAndClose(): void {
  if (pendingCloseTabId.value) {
    editorStore.forceCloseTab(pendingCloseTabId.value);
  }
  closeModal();
}

function closeModal(): void {
  showUnsavedModal.value = false;
  pendingCloseTabId.value = null;
  pendingCloseTabName.value = '';
}

// Warn before leaving page with unsaved changes
function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (editorStore.hasUnsavedChanges) {
    event.preventDefault();
    // Most browsers ignore custom messages, but this is required
    event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>

<template>
  <div class="editor-layout" :class="{ 'side-collapsed': uiStore.sidePanelCollapsed }">
    <ActivityBar class="activity-bar" />
    <SidePanel class="side-panel" />
    <div class="main-area">
      <TabBar class="tab-bar" @close-tab-request="handleCloseTabRequest" />
      <div class="editor-content">
        <slot></slot>
      </div>
    </div>
    <StatusBar class="status-bar" />

    <!-- Unsaved changes modal -->
    <NModal v-model:show="showUnsavedModal" :mask-closable="false">
      <NCard
        style="width: 400px"
        title="Unsaved Changes"
        :bordered="false"
        role="dialog"
        aria-modal="true"
      >
        <p>
          <strong>{{ pendingCloseTabName }}</strong> has unsaved changes.
          Do you want to save before closing?
        </p>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="closeModal">Cancel</NButton>
            <NButton @click="handleDiscardAndClose">Don't Save</NButton>
            <NButton type="primary" @click="handleSaveAndClose">Save</NButton>
          </NSpace>
        </template>
      </NCard>
    </NModal>
  </div>
</template>

<style scoped>
.editor-layout {
  display: grid;
  grid-template-columns: 48px v-bind(sidePanelWidth) 1fr;
  grid-template-rows: 1fr auto;
  grid-template-areas:
    "activity side main"
    "status status status";
  height: 100%;
  overflow: hidden;
  transition: grid-template-columns 0.2s ease;
}

.editor-layout.side-collapsed {
  grid-template-columns: 48px 0px 1fr;
}

.activity-bar {
  grid-area: activity;
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
}

.side-panel {
  grid-area: side;
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
}

.editor-layout.side-collapsed .side-panel {
  display: none;
}

.main-area {
  grid-area: main;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.tab-bar {
  flex-shrink: 0;
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.editor-content {
  flex: 1;
  overflow: hidden;
  background-color: var(--color-bg);
}

.status-bar {
  grid-area: status;
  background-color: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border);
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .editor-layout {
    grid-template-columns: 48px 0px 1fr;
  }

  .editor-layout:not(.side-collapsed) {
    grid-template-columns: 48px 100% 0px;
  }

  .editor-layout:not(.side-collapsed) .main-area {
    display: none;
  }
}
</style>
