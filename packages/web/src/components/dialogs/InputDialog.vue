<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { NModal, NButton, NSpace, NInput, NFormItem } from 'naive-ui';
import { useDialog } from '../../composables/useDialog';

const dialog = useDialog();

const inputValue = ref('');
const validationError = ref<string | null>(null);

// Reset input when dialog opens
watch(
  () => dialog.isInputDialogVisible.value,
  (visible) => {
    if (visible) {
      inputValue.value = dialog.inputDialogOptions.value.defaultValue ?? '';
      validationError.value = null;
    }
  }
);

const isValid = computed(() => {
  const validate = dialog.inputDialogOptions.value.validate;
  if (!validate) return true;

  const result = validate(inputValue.value);
  if (result === true) return true;
  return false;
});

function validate(): boolean {
  const validateFn = dialog.inputDialogOptions.value.validate;
  if (!validateFn) return true;

  const result = validateFn(inputValue.value);
  if (result === true) {
    validationError.value = null;
    return true;
  }

  validationError.value = typeof result === 'string' ? result : 'Invalid input';
  return false;
}

function handleConfirm(): void {
  if (!validate()) return;
  dialog.resolveInput(true, inputValue.value);
}

function handleCancel(): void {
  dialog.resolveInput(false, '');
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleConfirm();
  }
}
</script>

<template>
  <NModal
    :show="dialog.isInputDialogVisible.value"
    preset="dialog"
    :title="dialog.inputDialogOptions.value.title"
    :closable="dialog.inputDialogOptions.value.closable"
    @close="handleCancel"
    @mask-click="handleCancel"
    class="input-dialog"
  >
    <p v-if="dialog.inputDialogOptions.value.content" class="dialog-content">
      {{ dialog.inputDialogOptions.value.content }}
    </p>

    <NFormItem
      :label="dialog.inputDialogOptions.value.label"
      :validation-status="validationError ? 'error' : undefined"
      :feedback="validationError ?? undefined"
    >
      <NInput
        v-model:value="inputValue"
        :placeholder="dialog.inputDialogOptions.value.placeholder"
        @keydown="handleKeydown"
        autofocus
      />
    </NFormItem>

    <template #action>
      <NSpace justify="end">
        <NButton @click="handleCancel">
          {{ dialog.inputDialogOptions.value.negativeText }}
        </NButton>
        <NButton
          type="primary"
          :disabled="!isValid"
          @click="handleConfirm"
        >
          {{ dialog.inputDialogOptions.value.positiveText }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.dialog-content {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);
}
</style>
