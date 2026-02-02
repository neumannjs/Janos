import { ref } from 'vue';

export interface DialogOptions {
  title?: string;
  content?: string;
  positiveText?: string;
  negativeText?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  closable?: boolean;
}

export interface InputDialogOptions extends DialogOptions {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  validate?: (value: string) => boolean | string;
}

export interface ConfirmDialogResult {
  confirmed: boolean;
}

export interface InputDialogResult {
  confirmed: boolean;
  value: string;
}

// Dialog state (shared across app)
const isConfirmDialogVisible = ref(false);
const isInputDialogVisible = ref(false);

const confirmDialogOptions = ref<DialogOptions>({});
const inputDialogOptions = ref<InputDialogOptions>({});

let confirmResolve: ((result: ConfirmDialogResult) => void) | null = null;
let inputResolve: ((result: InputDialogResult) => void) | null = null;

export function useDialog() {
  // Confirm dialog
  function confirm(options: DialogOptions): Promise<ConfirmDialogResult> {
    return new Promise((resolve) => {
      confirmDialogOptions.value = {
        title: options.title ?? 'Confirm',
        content: options.content,
        positiveText: options.positiveText ?? 'Yes',
        negativeText: options.negativeText ?? 'No',
        type: options.type ?? 'info',
        closable: options.closable ?? true,
      };
      confirmResolve = resolve;
      isConfirmDialogVisible.value = true;
    });
  }

  function resolveConfirm(confirmed: boolean): void {
    isConfirmDialogVisible.value = false;
    if (confirmResolve) {
      confirmResolve({ confirmed });
      confirmResolve = null;
    }
  }

  // Input dialog
  function showInput(options: InputDialogOptions): Promise<InputDialogResult> {
    return new Promise((resolve) => {
      inputDialogOptions.value = {
        title: options.title ?? 'Input',
        content: options.content,
        label: options.label,
        placeholder: options.placeholder,
        defaultValue: options.defaultValue ?? '',
        positiveText: options.positiveText ?? 'OK',
        negativeText: options.negativeText ?? 'Cancel',
        validate: options.validate,
        closable: options.closable ?? true,
      };
      inputResolve = resolve;
      isInputDialogVisible.value = true;
    });
  }

  function resolveInput(confirmed: boolean, value: string): void {
    isInputDialogVisible.value = false;
    if (inputResolve) {
      inputResolve({ confirmed, value });
      inputResolve = null;
    }
  }

  // Convenience methods
  async function confirmDelete(itemName: string): Promise<boolean> {
    const result = await confirm({
      title: 'Delete',
      content: `Are you sure you want to delete "${itemName}"? This cannot be undone.`,
      positiveText: 'Delete',
      negativeText: 'Cancel',
      type: 'warning',
    });
    return result.confirmed;
  }

  async function confirmDiscard(): Promise<boolean> {
    const result = await confirm({
      title: 'Unsaved Changes',
      content: 'You have unsaved changes. Do you want to discard them?',
      positiveText: 'Discard',
      negativeText: 'Cancel',
      type: 'warning',
    });
    return result.confirmed;
  }

  async function promptFilename(defaultValue?: string): Promise<string | null> {
    const result = await showInput({
      title: 'Enter Filename',
      label: 'Filename',
      placeholder: 'example.md',
      defaultValue,
      validate: (value) => {
        if (!value.trim()) return 'Filename is required';
        if (value.includes('/')) return 'Filename cannot contain /';
        return true;
      },
    });
    return result.confirmed ? result.value : null;
  }

  async function promptFolderName(defaultValue?: string): Promise<string | null> {
    const result = await showInput({
      title: 'Enter Folder Name',
      label: 'Folder name',
      placeholder: 'new-folder',
      defaultValue,
      validate: (value) => {
        if (!value.trim()) return 'Folder name is required';
        if (value.includes('/')) return 'Folder name cannot contain /';
        return true;
      },
    });
    return result.confirmed ? result.value : null;
  }

  return {
    // State (for dialog components to bind to)
    isConfirmDialogVisible,
    isInputDialogVisible,
    confirmDialogOptions,
    inputDialogOptions,

    // Actions
    confirm,
    resolveConfirm,
    showInput,
    resolveInput,

    // Convenience methods
    confirmDelete,
    confirmDiscard,
    promptFilename,
    promptFolderName,
  };
}
