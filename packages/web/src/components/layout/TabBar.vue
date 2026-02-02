<script setup lang="ts">
import { computed, h } from 'vue';
import { NTabs, NTabPane, NButton, NDropdown } from 'naive-ui';
import { PersonCircleOutline } from '@vicons/ionicons5';
import { useEditorStore } from '../../stores/editor';
import { useAuthStore } from '../../stores/auth';

const editorStore = useEditorStore();
const authStore = useAuthStore();

const emit = defineEmits<{
  (e: 'close-tab', tabId: string): void;
  (e: 'close-tab-request', tabId: string): void;
}>();

function handleTabChange(tabId: string): void {
  editorStore.setActiveTab(tabId);
}

function handleCloseTab(tabId: string, event?: MouseEvent): void {
  event?.stopPropagation();

  const tab = editorStore.tabs.find((t) => t.id === tabId);
  if (tab?.isDirty) {
    // Emit event for parent to handle confirmation dialog
    emit('close-tab-request', tabId);
  } else {
    editorStore.closeTab(tabId);
  }
}

const profileMenuOptions = computed(() => [
  {
    label: authStore.user?.name ?? 'User',
    key: 'user',
    disabled: true,
  },
  {
    type: 'divider',
    key: 'd1',
  },
  {
    label: 'Sign Out',
    key: 'signout',
  },
]);

function handleProfileAction(key: string): void {
  if (key === 'signout') {
    authStore.logout();
  }
}

</script>

<template>
  <div class="tab-bar">
    <div class="tabs-container">
      <NTabs
        v-if="editorStore.tabs.length > 0"
        type="card"
        :value="editorStore.activeTabId ?? undefined"
        @update:value="handleTabChange"
        closable
        @close="handleCloseTab"
        class="editor-tabs"
      >
        <NTabPane
          v-for="tab in editorStore.tabs"
          :key="tab.id"
          :name="tab.id"
          :tab="() => h('span', { class: { dirty: tab.isDirty } }, tab.name)"
          :closable="true"
        />
      </NTabs>
      <div v-else class="no-tabs">
        <!-- Empty state - no tabs open -->
      </div>
    </div>

    <div class="tab-bar-actions">
      <NDropdown
        :options="profileMenuOptions"
        @select="handleProfileAction"
        trigger="click"
        placement="bottom-end"
      >
        <NButton quaternary size="small" class="profile-button">
          <template #icon>
            <PersonCircleOutline />
          </template>
          <span v-if="authStore.user" class="profile-name">
            {{ authStore.user.username }}
          </span>
        </NButton>
      </NDropdown>
    </div>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 8px;
}

.tabs-container {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.no-tabs {
  height: 100%;
}

.tab-bar-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 8px;
}

.profile-button {
  padding: 4px 8px;
}

.profile-name {
  margin-left: 4px;
  font-size: 12px;
}

/* Tab styling */
.editor-tabs :deep(.n-tabs-tab-pad) {
  width: 0;
}

.editor-tabs :deep(.n-tabs-tab) {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 0;
  margin: 0;
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
}

.editor-tabs :deep(.n-tabs-tab--active) {
  background-color: var(--color-bg);
}

.editor-tabs :deep(.n-tabs-tab .dirty::after) {
  content: ' ●';
  color: var(--color-primary);
  font-size: 10px;
}

.editor-tabs :deep(.n-tabs-tab__close) {
  margin-left: 8px;
}

.editor-tabs :deep(.n-tabs-wrapper) {
  padding: 0;
}

.editor-tabs :deep(.n-tabs-scroll-padding) {
  width: 0;
}
</style>
