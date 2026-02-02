<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, shallowRef } from 'vue';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';

const props = defineProps<{
  modelValue: string;
  language?: string;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'save'): void;
  (e: 'cursor-change', position: { line: number; column: number }): void;
}>();

const editorContainer = ref<HTMLElement | null>(null);
const editorView = shallowRef<EditorView | null>(null);

// Janos dark theme
const janosTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
    fontSize: '14px',
    lineHeight: '1.6',
    caretColor: 'var(--color-primary)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--color-primary)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(233, 69, 96, 0.3)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-bg-secondary)',
    color: 'var(--color-text-secondary)',
    border: 'none',
    borderRight: '1px solid var(--color-border)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 16px',
    minWidth: '40px',
  },
  '.cm-foldGutter': {
    width: '16px',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--color-bg-tertiary)',
    color: 'var(--color-text-secondary)',
    border: 'none',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(233, 69, 96, 0.3)',
    outline: '1px solid var(--color-primary)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(255, 170, 0, 0.3)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(255, 170, 0, 0.5)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
});

// Get language extension based on language prop
function getLanguageExtension(): Extension | null {
  switch (props.language) {
    case 'markdown':
      return markdown();
    case 'html':
      return html();
    case 'css':
      return css();
    case 'javascript':
      return javascript();
    case 'json':
      return json();
    default:
      return null;
  }
}

// Create editor extensions
function createExtensions(): Extension[] {
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    bracketMatching(),
    foldGutter(),
    history(),
    syntaxHighlighting(defaultHighlightStyle),
    janosTheme,
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
      {
        key: 'Mod-s',
        run: () => {
          emit('save');
          return true;
        },
      },
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString());
      }
      if (update.selectionSet) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        emit('cursor-change', {
          line: line.number,
          column: pos - line.from + 1,
        });
      }
    }),
  ];

  if (props.readonly) {
    extensions.push(EditorState.readOnly.of(true));
  }

  const langExt = getLanguageExtension();
  if (langExt) {
    extensions.push(langExt);
  }

  return extensions;
}

// Initialize editor
function initEditor(): void {
  if (!editorContainer.value) return;

  // Clean up existing editor
  if (editorView.value) {
    editorView.value.destroy();
  }

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: createExtensions(),
  });

  editorView.value = new EditorView({
    state,
    parent: editorContainer.value,
  });
}

// Update content when modelValue changes externally
watch(
  () => props.modelValue,
  (newValue) => {
    if (!editorView.value) return;

    const currentValue = editorView.value.state.doc.toString();
    if (newValue !== currentValue) {
      editorView.value.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: newValue,
        },
      });
    }
  }
);

// Reinitialize on language change
watch(
  () => props.language,
  () => {
    initEditor();
  }
);

onMounted(() => {
  initEditor();
});

onUnmounted(() => {
  if (editorView.value) {
    editorView.value.destroy();
    editorView.value = null;
  }
});

// Expose methods for parent components
defineExpose({
  focus: () => editorView.value?.focus(),
  getContent: () => editorView.value?.state.doc.toString() ?? '',
});
</script>

<template>
  <div ref="editorContainer" class="code-editor"></div>
</template>

<style scoped>
.code-editor {
  height: 100%;
  overflow: hidden;
}

.code-editor :deep(.cm-editor) {
  height: 100%;
}

.code-editor :deep(.cm-scroller) {
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
}
</style>
