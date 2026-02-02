<script setup lang="ts">
import { ref, computed } from 'vue';
import { NModal, NButton, NSpace, NInput, NAlert, NProgress } from 'naive-ui';

const props = defineProps<{
  show: boolean;
  defaultUser?: string;
  defaultRepo?: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'clone', url: string): void;
}>();

const repoUrl = ref('');
const useCustomUrl = ref(false);
const isCloning = ref(false);
const cloneProgress = ref(0);
const cloneError = ref<string | null>(null);

// Suggested repo URL based on env config
const suggestedUrl = computed(() => {
  if (props.defaultUser && props.defaultRepo) {
    return `https://github.com/${props.defaultUser}/${props.defaultRepo}`;
  }
  return null;
});

const canClone = computed(() => {
  if (useCustomUrl.value) {
    return repoUrl.value.trim().length > 0;
  }
  return suggestedUrl.value !== null;
});

const cloneUrl = computed(() => {
  if (useCustomUrl.value) {
    return repoUrl.value.trim();
  }
  return suggestedUrl.value ?? '';
});

function handleClone(): void {
  if (!canClone.value) return;
  cloneError.value = null;
  emit('clone', cloneUrl.value);
}

function handleClose(): void {
  if (!isCloning.value) {
    emit('update:show', false);
  }
}

function switchToCustom(): void {
  useCustomUrl.value = true;
  repoUrl.value = suggestedUrl.value ?? '';
}

// Expose methods for parent to update progress
defineExpose({
  setCloning: (value: boolean) => { isCloning.value = value; },
  setProgress: (value: number) => { cloneProgress.value = value; },
  setError: (error: string | null) => { cloneError.value = error; },
});
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="Clone Repository"
    :closable="!isCloning"
    :mask-closable="!isCloning"
    @close="handleClose"
    @mask-click="handleClose"
    style="width: 480px"
  >
    <div class="clone-dialog">
      <!-- Error alert -->
      <NAlert v-if="cloneError" type="error" :show-icon="true" class="clone-error">
        {{ cloneError }}
      </NAlert>

      <!-- Cloning progress -->
      <div v-if="isCloning" class="cloning-progress">
        <p>Cloning repository...</p>
        <NProgress
          type="line"
          :percentage="cloneProgress"
          :show-indicator="true"
          status="success"
        />
      </div>

      <!-- Clone options -->
      <template v-else>
        <!-- Suggested repo (if configured) -->
        <div v-if="suggestedUrl && !useCustomUrl" class="suggested-repo">
          <p class="description">
            Clone your configured repository to get started:
          </p>
          <div class="repo-card">
            <div class="repo-info">
              <span class="repo-name">{{ defaultUser }}/{{ defaultRepo }}</span>
              <span class="repo-url">{{ suggestedUrl }}</span>
            </div>
          </div>
          <NSpace vertical class="actions">
            <NButton type="primary" block @click="handleClone">
              Clone Repository
            </NButton>
            <NButton text size="small" @click="switchToCustom">
              Or enter a different repository URL
            </NButton>
          </NSpace>
        </div>

        <!-- Custom URL input -->
        <div v-else class="custom-url">
          <p class="description">
            Enter the URL of the repository you want to clone:
          </p>
          <NInput
            v-model:value="repoUrl"
            placeholder="https://github.com/user/repo"
            @keyup.enter="handleClone"
          />
          <NSpace class="actions">
            <NButton
              v-if="suggestedUrl"
              @click="useCustomUrl = false"
            >
              Back
            </NButton>
            <NButton
              type="primary"
              :disabled="!canClone"
              @click="handleClone"
            >
              Clone
            </NButton>
          </NSpace>
        </div>
      </template>
    </div>
  </NModal>
</template>

<style scoped>
.clone-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.clone-error {
  margin-bottom: 8px;
}

.cloning-progress {
  text-align: center;
  padding: 24px 0;
}

.cloning-progress p {
  margin-bottom: 16px;
  color: var(--color-text-secondary);
}

.description {
  color: var(--color-text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}

.repo-card {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.repo-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.repo-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text);
}

.repo-url {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.actions {
  margin-top: 16px;
}

.custom-url .actions {
  justify-content: flex-end;
}
</style>
