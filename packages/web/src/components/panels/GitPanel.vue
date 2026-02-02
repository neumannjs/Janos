<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  NButton,
  NInput,
  NSelect,
  NEmpty,
  NList,
  NListItem,
  NSpace,
  NTag,
  NSpin,
} from 'naive-ui';
import {
  SyncOutline,
  CloudUploadOutline,
  CloudDownloadOutline,
  AddOutline,
  RemoveOutline,
} from '@vicons/ionicons5';
import { useGitStore } from '../../stores/git';
import { useEditorStore } from '../../stores/editor';
import { useNotificationsStore } from '../../stores/notifications';

const gitStore = useGitStore();
const editorStore = useEditorStore();
const notificationsStore = useNotificationsStore();

const commitMessage = ref('');

// Branch options for select
const branchOptions = computed(() =>
  gitStore.branches.map((b) => ({
    label: b.name + (b.isCurrent ? ' (current)' : ''),
    value: b.name,
  }))
);

// Get status badge type
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

// Toggle file staging
async function toggleStage(filepath: string, isStaged: boolean): Promise<void> {
  try {
    if (isStaged) {
      await gitStore.unstage(filepath);
    } else {
      await gitStore.stage(filepath);
    }
  } catch (err) {
    notificationsStore.error(
      'Git Error',
      err instanceof Error ? err.message : 'Failed to update staging'
    );
  }
}

// Stage all changes
async function stageAll(): Promise<void> {
  try {
    for (const file of gitStore.unstagedFiles) {
      await gitStore.stage(file.path);
    }
  } catch (err) {
    notificationsStore.error('Git Error', 'Failed to stage all files');
  }
}

// Unstage all changes
async function unstageAll(): Promise<void> {
  try {
    for (const file of gitStore.stagedFiles) {
      await gitStore.unstage(file.path);
    }
  } catch (err) {
    notificationsStore.error('Git Error', 'Failed to unstage all files');
  }
}

// Commit changes
async function commit(): Promise<void> {
  if (!commitMessage.value.trim()) {
    notificationsStore.warning('Commit', 'Please enter a commit message');
    return;
  }

  if (gitStore.stagedFiles.length === 0) {
    notificationsStore.warning('Commit', 'No files staged for commit');
    return;
  }

  try {
    const sha = await gitStore.commit(commitMessage.value);
    commitMessage.value = '';
    notificationsStore.success('Committed', `Created commit ${sha.substring(0, 7)}`);
  } catch (err) {
    notificationsStore.error(
      'Commit Failed',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
}

// Push changes
async function push(): Promise<void> {
  try {
    await gitStore.push();
    notificationsStore.success('Pushed', 'Changes pushed to remote');
  } catch (err) {
    notificationsStore.error(
      'Push Failed',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
}

// Pull changes
async function pull(): Promise<void> {
  // Check for unsaved changes
  if (editorStore.hasUnsavedChanges) {
    notificationsStore.warning(
      'Unsaved Changes',
      'Please save or discard changes before pulling'
    );
    return;
  }

  try {
    await gitStore.pull();
    notificationsStore.success('Pulled', 'Changes pulled from remote');
  } catch (err) {
    notificationsStore.error(
      'Pull Failed',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
}

// Switch branch
async function switchBranch(branchName: string): Promise<void> {
  if (branchName === gitStore.currentBranch) return;

  // Check for unsaved changes
  if (editorStore.hasUnsavedChanges) {
    notificationsStore.warning(
      'Unsaved Changes',
      'Please save or discard changes before switching branches'
    );
    return;
  }

  try {
    await gitStore.checkout(branchName);
    notificationsStore.info('Branch', `Switched to ${branchName}`);
  } catch (err) {
    notificationsStore.error(
      'Checkout Failed',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
}

// Refresh status
async function refresh(): Promise<void> {
  await gitStore.refreshStatus();
  await gitStore.refreshBranches();
}
</script>

<template>
  <div class="git-panel">
    <NSpin :show="gitStore.loading" class="git-spin">
      <!-- No repo state -->
      <NEmpty
        v-if="!gitStore.isRepo"
        description="No repository"
        class="empty-state"
      />

      <template v-else>
        <!-- Branch selector -->
        <div class="git-section">
          <div class="section-header">
            <span>Branch</span>
            <NButton quaternary size="tiny" @click="refresh">
              <template #icon>
                <SyncOutline />
              </template>
            </NButton>
          </div>
          <NSelect
            :value="gitStore.currentBranch"
            :options="branchOptions"
            size="small"
            @update:value="switchBranch"
            class="branch-select"
          />
        </div>

        <!-- Staged changes -->
        <div class="git-section" v-if="gitStore.stagedFiles.length > 0">
          <div class="section-header">
            <span>Staged Changes ({{ gitStore.stagedFiles.length }})</span>
            <NButton quaternary size="tiny" @click="unstageAll" title="Unstage All">
              <template #icon>
                <RemoveOutline />
              </template>
            </NButton>
          </div>
          <NList class="git-file-list">
            <NListItem v-for="file in gitStore.stagedFiles" :key="file.path">
              <div class="file-item" @click="toggleStage(file.path, true)">
                <span class="file-name">{{ file.path.split('/').pop() }}</span>
                <NTag size="tiny" :type="getStatusType(file.stagedStatus)">
                  {{ file.stagedStatus.charAt(0).toUpperCase() }}
                </NTag>
              </div>
            </NListItem>
          </NList>
        </div>

        <!-- Unstaged changes -->
        <div class="git-section" v-if="gitStore.unstagedFiles.length > 0">
          <div class="section-header">
            <span>Changes ({{ gitStore.unstagedFiles.length }})</span>
            <NButton quaternary size="tiny" @click="stageAll" title="Stage All">
              <template #icon>
                <AddOutline />
              </template>
            </NButton>
          </div>
          <NList class="git-file-list">
            <NListItem v-for="file in gitStore.unstagedFiles" :key="file.path">
              <div class="file-item" @click="toggleStage(file.path, false)">
                <span class="file-name">{{ file.path.split('/').pop() }}</span>
                <NTag size="tiny" :type="getStatusType(file.workdirStatus)">
                  {{ file.workdirStatus.charAt(0).toUpperCase() }}
                </NTag>
              </div>
            </NListItem>
          </NList>
        </div>

        <!-- No changes -->
        <div
          v-if="gitStore.stagedFiles.length === 0 && gitStore.unstagedFiles.length === 0"
          class="no-changes"
        >
          No changes
        </div>

        <!-- Commit form -->
        <div class="git-section commit-section">
          <NInput
            v-model:value="commitMessage"
            type="textarea"
            placeholder="Commit message"
            :autosize="{ minRows: 2, maxRows: 4 }"
            size="small"
          />
          <NButton
            type="primary"
            size="small"
            block
            :disabled="!commitMessage.trim() || gitStore.stagedFiles.length === 0"
            @click="commit"
          >
            Commit
          </NButton>
        </div>

        <!-- Push/Pull actions -->
        <div class="git-section git-actions">
          <NSpace>
            <NButton size="small" @click="pull">
              <template #icon>
                <CloudDownloadOutline />
              </template>
              Pull
            </NButton>
            <NButton size="small" @click="push">
              <template #icon>
                <CloudUploadOutline />
              </template>
              Push
            </NButton>
          </NSpace>
        </div>
      </template>
    </NSpin>
  </div>
</template>

<style scoped>
.git-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px 12px;
}

.git-spin {
  height: 100%;
}

.git-section {
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.branch-select {
  width: 100%;
}

.git-file-list {
  background: transparent;
}

.git-file-list :deep(.n-list-item) {
  padding: 4px 0;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.file-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.file-name {
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-changes {
  padding: 16px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.commit-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.git-actions {
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.empty-state {
  padding: 32px 16px;
}
</style>
