<script setup lang="ts">
import { computed } from 'vue';
import { useEditorStore } from '../../stores/editor';
import { useNotificationsStore } from '../../stores/notifications';
import CodeEditor from './CodeEditor.vue';
import WelcomePane from './WelcomePane.vue';

const editorStore = useEditorStore();
const notificationsStore = useNotificationsStore();

const activeTab = computed(() => editorStore.activeTab);

// Handle content changes from CodeMirror
function handleContentChange(content: string): void {
  if (activeTab.value) {
    editorStore.updateContent(activeTab.value.id, content);
  }
}

// Handle cursor position changes
function handleCursorChange(position: { line: number; column: number }): void {
  if (activeTab.value) {
    editorStore.updateCursorPosition(activeTab.value.id, position);
  }
}

// Handle save
async function handleSave(): Promise<void> {
  if (!activeTab.value) return;

  try {
    await editorStore.saveActiveTab();
    notificationsStore.success('Saved', `${activeTab.value.name} saved`);
  } catch (err) {
    notificationsStore.error(
      'Save Failed',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
}
</script>

<template>
  <div class="editor-pane">
    <!-- Editor content -->
    <div v-if="activeTab" class="editor-container">
      <CodeEditor
        :key="activeTab.id"
        :model-value="activeTab.content"
        :language="activeTab.language"
        @update:model-value="handleContentChange"
        @cursor-change="handleCursorChange"
        @save="handleSave"
      />
    </div>

    <!-- Welcome pane when no files open -->
    <WelcomePane v-else />
  </div>
</template>

<style scoped>
.editor-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-container {
  flex: 1;
  overflow: hidden;
}
</style>
