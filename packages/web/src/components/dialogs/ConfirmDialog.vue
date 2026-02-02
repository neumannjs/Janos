<script setup lang="ts">
import { computed } from 'vue';
import { NModal, NButton, NSpace, NIcon } from 'naive-ui';
import {
  InformationCircleOutline,
  CheckmarkCircleOutline,
  WarningOutline,
  AlertCircleOutline,
} from '@vicons/ionicons5';
import { useDialog } from '../../composables/useDialog';

const dialog = useDialog();

const iconComponent = computed(() => {
  switch (dialog.confirmDialogOptions.value.type) {
    case 'success':
      return CheckmarkCircleOutline;
    case 'warning':
      return WarningOutline;
    case 'error':
      return AlertCircleOutline;
    default:
      return InformationCircleOutline;
  }
});

const iconColor = computed(() => {
  switch (dialog.confirmDialogOptions.value.type) {
    case 'success':
      return 'var(--color-success)';
    case 'warning':
      return 'var(--color-warning)';
    case 'error':
      return 'var(--color-error)';
    default:
      return 'var(--color-primary)';
  }
});

function handleConfirm(): void {
  dialog.resolveConfirm(true);
}

function handleCancel(): void {
  dialog.resolveConfirm(false);
}
</script>

<template>
  <NModal
    :show="dialog.isConfirmDialogVisible.value"
    preset="dialog"
    :title="dialog.confirmDialogOptions.value.title"
    :closable="dialog.confirmDialogOptions.value.closable"
    @close="handleCancel"
    @mask-click="handleCancel"
    class="confirm-dialog"
  >
    <template #icon>
      <NIcon :size="24" :color="iconColor">
        <component :is="iconComponent" />
      </NIcon>
    </template>

    <p class="dialog-content">
      {{ dialog.confirmDialogOptions.value.content }}
    </p>

    <template #action>
      <NSpace justify="end">
        <NButton @click="handleCancel">
          {{ dialog.confirmDialogOptions.value.negativeText }}
        </NButton>
        <NButton
          type="primary"
          @click="handleConfirm"
        >
          {{ dialog.confirmDialogOptions.value.positiveText }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.dialog-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);
}
</style>
