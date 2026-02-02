<script setup lang="ts">
import { ref, computed } from 'vue';
import { NModal, NButton, NSpace, NInput, NFormItem, NList, NListItem, NTag } from 'naive-ui';
import { useGitStore } from '../../stores/git';

defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'commit', message: string): void;
}>();

const gitStore = useGitStore();
const commitMessage = ref('');
const messageError = ref<string | null>(null);

const isValid = computed(() => {
  return commitMessage.value.trim().length > 0 && gitStore.stagedFiles.length > 0;
});

function getStatusType(status: string): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'added':
      return 'success';
    case 'modified':
      return 'warning';
    case 'deleted':
      return 'error';
    default:
      return 'info';
  }
}

function handleCommit(): void {
  if (!commitMessage.value.trim()) {
    messageError.value = 'Commit message is required';
    return;
  }

  if (gitStore.stagedFiles.length === 0) {
    messageError.value = 'No files staged for commit';
    return;
  }

  emit('commit', commitMessage.value);
  commitMessage.value = '';
  messageError.value = null;
  emit('update:show', false);
}

function handleClose(): void {
  emit('update:show', false);
}
</script>

<template>
  <NModal
    :show="show"
    preset="dialog"
    title="Commit Changes"
    :closable="true"
    @close="handleClose"
    @mask-click="handleClose"
    class="commit-dialog"
    style="width: 500px"
  >
    <!-- Staged files list -->
    <div v-if="gitStore.stagedFiles.length > 0" class="staged-files">
      <p class="section-label">Staged Changes ({{ gitStore.stagedFiles.length }})</p>
      <NList class="file-list" :show-divider="false">
        <NListItem v-for="file in gitStore.stagedFiles" :key="file.path">
          <div class="file-item">
            <span class="file-name">{{ file.path }}</span>
            <NTag size="tiny" :type="getStatusType(file.stagedStatus)">
              {{ file.stagedStatus.charAt(0).toUpperCase() }}
            </NTag>
          </div>
        </NListItem>
      </NList>
    </div>

    <div v-else class="no-staged">
      <p>No files staged for commit</p>
    </div>

    <!-- Commit message -->
    <NFormItem
      label="Commit Message"
      :validation-status="messageError ? 'error' : undefined"
      :feedback="messageError ?? undefined"
    >
      <NInput
        v-model:value="commitMessage"
        type="textarea"
        placeholder="Describe your changes..."
        :autosize="{ minRows: 3, maxRows: 6 }"
      />
    </NFormItem>

    <template #action>
      <NSpace justify="end">
        <NButton @click="handleClose">
          Cancel
        </NButton>
        <NButton
          type="primary"
          :disabled="!isValid"
          @click="handleCommit"
        >
          Commit
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.staged-files {
  margin-bottom: 16px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.file-list {
  max-height: 150px;
  overflow-y: auto;
  background-color: var(--color-bg);
  border-radius: 4px;
  padding: 4px;
}

.file-list :deep(.n-list-item) {
  padding: 4px 8px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-name {
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-staged {
  padding: 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
  background-color: var(--color-bg);
  border-radius: 4px;
  margin-bottom: 16px;
}
</style>
