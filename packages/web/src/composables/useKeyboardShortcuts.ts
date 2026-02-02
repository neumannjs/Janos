import { onMounted, onUnmounted } from 'vue';
import { useEditorStore } from '../stores/editor';
import { useDialog } from './useDialog';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void | Promise<void>;
  description?: string;
}

// Check if running on macOS
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export function useKeyboardShortcuts() {
  const editorStore = useEditorStore();
  const dialog = useDialog();

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 's',
      meta: isMac,
      ctrl: !isMac,
      handler: async () => {
        if (editorStore.activeTab?.isDirty) {
          await editorStore.saveActiveTab();
        }
      },
      description: 'Save file',
    },
    {
      key: 'w',
      meta: isMac,
      ctrl: !isMac,
      handler: async () => {
        if (editorStore.activeTabId) {
          const tab = editorStore.activeTab;
          if (tab?.isDirty) {
            const confirmed = await dialog.confirmDiscard();
            if (confirmed) {
              editorStore.forceCloseTab(editorStore.activeTabId);
            }
          } else {
            editorStore.closeTab(editorStore.activeTabId);
          }
        }
      },
      description: 'Close tab',
    },
    {
      key: 's',
      meta: isMac,
      ctrl: !isMac,
      shift: true,
      handler: async () => {
        await editorStore.saveAllTabs();
      },
      description: 'Save all files',
    },
  ];

  function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
    if (shortcut.ctrl && !event.ctrlKey) return false;
    if (shortcut.meta && !event.metaKey) return false;
    if (shortcut.shift && !event.shiftKey) return false;
    if (shortcut.alt && !event.altKey) return false;

    // If shortcut doesn't specify modifier, make sure it's not pressed
    if (!shortcut.ctrl && !shortcut.meta && (event.ctrlKey || event.metaKey)) return false;
    if (!shortcut.shift && event.shiftKey) return false;
    if (!shortcut.alt && event.altKey) return false;

    return true;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    // Ignore if focus is in an input or textarea (CodeMirror handles its own shortcuts)
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    for (const shortcut of shortcuts) {
      if (matchesShortcut(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.handler();
        return;
      }
    }
  }

  function setup(): void {
    window.addEventListener('keydown', handleKeyDown);
  }

  function cleanup(): void {
    window.removeEventListener('keydown', handleKeyDown);
  }

  // Auto-setup when composable is used in a component
  onMounted(setup);
  onUnmounted(cleanup);

  return {
    shortcuts,
    setup,
    cleanup,
  };
}

// Utility to format shortcut for display
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Win');

  parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? '' : '+');
}
