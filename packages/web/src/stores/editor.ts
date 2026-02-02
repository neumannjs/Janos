import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useFileSystemStore } from './filesystem';

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  content: string;
  originalContent: string;
  language: string;
  isDirty: boolean;
  cursorPosition?: { line: number; column: number };
}

// Map file extensions to CodeMirror languages
const LANGUAGE_MAP: Record<string, string> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.njk': 'html',
  '.nunjucks': 'html',
  '.hbs': 'html',
  '.handlebars': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'javascript',
  '.tsx': 'javascript',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'html',
  '.svg': 'html',
};

function getLanguageFromPath(path: string): string {
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
  return LANGUAGE_MAP[ext] || 'text';
}

function getFileNameFromPath(path: string): string {
  return path.split('/').pop() ?? path;
}

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const useEditorStore = defineStore('editor', () => {
  const fsStore = useFileSystemStore();

  // State
  const tabs = ref<EditorTab[]>([]);
  const activeTabId = ref<string | null>(null);
  const previewSplit = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const activeTab = computed(() =>
    tabs.value.find((t) => t.id === activeTabId.value) ?? null
  );

  const hasUnsavedChanges = computed(() =>
    tabs.value.some((t) => t.isDirty)
  );

  const unsavedTabs = computed(() =>
    tabs.value.filter((t) => t.isDirty)
  );

  const tabByPath = computed(() => {
    const map = new Map<string, EditorTab>();
    for (const tab of tabs.value) {
      map.set(tab.path, tab);
    }
    return map;
  });

  // Actions
  async function openFile(path: string): Promise<EditorTab> {
    // Check if already open
    const existing = tabByPath.value.get(path);
    if (existing) {
      activeTabId.value = existing.id;
      return existing;
    }

    loading.value = true;
    error.value = null;

    try {
      const content = await fsStore.readFile(path);
      const tab: EditorTab = {
        id: generateTabId(),
        path,
        name: getFileNameFromPath(path),
        content,
        originalContent: content,
        language: getLanguageFromPath(path),
        isDirty: false,
      };

      tabs.value.push(tab);
      activeTabId.value = tab.id;

      return tab;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to open file';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function setActiveTab(tabId: string): void {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (tab) {
      activeTabId.value = tabId;
    }
  }

  function updateContent(tabId: string, content: string): void {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (tab) {
      tab.content = content;
      tab.isDirty = content !== tab.originalContent;
    }
  }

  function updateCursorPosition(
    tabId: string,
    position: { line: number; column: number }
  ): void {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (tab) {
      tab.cursorPosition = position;
    }
  }

  async function saveTab(tabId: string): Promise<void> {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (!tab) return;

    loading.value = true;
    error.value = null;

    try {
      await fsStore.writeFile(tab.path, tab.content);
      tab.originalContent = tab.content;
      tab.isDirty = false;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save file';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function saveActiveTab(): Promise<void> {
    if (activeTabId.value) {
      await saveTab(activeTabId.value);
    }
  }

  async function saveAllTabs(): Promise<void> {
    const dirtyTabs = tabs.value.filter((t) => t.isDirty);
    for (const tab of dirtyTabs) {
      await saveTab(tab.id);
    }
  }

  function closeTab(tabId: string): boolean {
    const index = tabs.value.findIndex((t) => t.id === tabId);
    if (index === -1) return false;

    const tab = tabs.value[index];

    // Return false if tab has unsaved changes (caller should handle confirmation)
    if (tab.isDirty) {
      return false;
    }

    tabs.value.splice(index, 1);

    // Update active tab if we closed the active one
    if (activeTabId.value === tabId) {
      if (tabs.value.length > 0) {
        // Activate the tab to the left, or the first one
        const newIndex = Math.max(0, index - 1);
        activeTabId.value = tabs.value[newIndex].id;
      } else {
        activeTabId.value = null;
      }
    }

    return true;
  }

  function forceCloseTab(tabId: string): void {
    const index = tabs.value.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    tabs.value.splice(index, 1);

    if (activeTabId.value === tabId) {
      if (tabs.value.length > 0) {
        const newIndex = Math.max(0, index - 1);
        activeTabId.value = tabs.value[newIndex].id;
      } else {
        activeTabId.value = null;
      }
    }
  }

  function closeAllTabs(): boolean {
    if (hasUnsavedChanges.value) {
      return false;
    }
    tabs.value = [];
    activeTabId.value = null;
    return true;
  }

  function closeOtherTabs(tabId: string): boolean {
    const otherDirty = tabs.value.filter((t) => t.id !== tabId && t.isDirty);
    if (otherDirty.length > 0) {
      return false;
    }

    tabs.value = tabs.value.filter((t) => t.id === tabId);
    activeTabId.value = tabId;
    return true;
  }

  function revertTab(tabId: string): void {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (tab) {
      tab.content = tab.originalContent;
      tab.isDirty = false;
    }
  }

  function togglePreviewSplit(): void {
    previewSplit.value = !previewSplit.value;
  }

  // Reorder tabs (for drag-drop)
  function reorderTabs(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= tabs.value.length) return;
    if (toIndex < 0 || toIndex >= tabs.value.length) return;

    const [tab] = tabs.value.splice(fromIndex, 1);
    tabs.value.splice(toIndex, 0, tab);
  }

  // Check if a file is currently open
  function isFileOpen(path: string): boolean {
    return tabByPath.value.has(path);
  }

  // Get tab by path
  function getTabByPath(path: string): EditorTab | undefined {
    return tabByPath.value.get(path);
  }

  return {
    // State
    tabs,
    activeTabId,
    previewSplit,
    loading,
    error,

    // Computed
    activeTab,
    hasUnsavedChanges,
    unsavedTabs,

    // Actions
    openFile,
    setActiveTab,
    updateContent,
    updateCursorPosition,
    saveTab,
    saveActiveTab,
    saveAllTabs,
    closeTab,
    forceCloseTab,
    closeAllTabs,
    closeOtherTabs,
    revertTab,
    togglePreviewSplit,
    reorderTabs,
    isFileOpen,
    getTabByPath,
  };
});
