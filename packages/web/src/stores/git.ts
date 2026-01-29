import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import {
  createIsomorphicGit,
  type IGitProvider,
  type GitFileStatus,
  type GitCommit,
  type GitBranch,
} from '@janos/core';
import { useFileSystemStore } from './filesystem';
import { useAuthStore } from './auth';

export const useGitStore = defineStore('git', () => {
  const fsStore = useFileSystemStore();
  const authStore = useAuthStore();

  // State
  const git = shallowRef<IGitProvider | null>(null);
  const initialized = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const repoPath = ref<string>('/repo');
  const status = ref<GitFileStatus[]>([]);
  const branches = ref<GitBranch[]>([]);
  const currentBranch = ref<string | null>(null);
  const commits = ref<GitCommit[]>([]);

  // Computed
  const isRepo = computed(() => initialized.value && git.value !== null);
  const hasChanges = computed(() => status.value.some(
    (s) => s.stagedStatus !== 'unmodified' || s.workdirStatus !== 'unmodified'
  ));
  const stagedFiles = computed(() => status.value.filter(
    (s) => s.stagedStatus !== 'unmodified' && s.stagedStatus !== 'absent'
  ));
  const unstagedFiles = computed(() => status.value.filter(
    (s) => s.workdirStatus !== 'unmodified' && s.workdirStatus !== 'absent'
  ));

  // Initialize git provider
  async function initialize(dir?: string): Promise<void> {
    if (!fsStore.initialized) {
      await fsStore.initialize();
    }

    const fs = fsStore.fs;
    if (!fs) {
      throw new Error('Filesystem not available');
    }

    const path = dir ?? repoPath.value;

    git.value = createIsomorphicGit({
      fs,
      dir: path,
      onAuth: () => {
        const token = authStore.accessToken;
        if (!token) {
          throw new Error('Not authenticated');
        }
        return {
          username: 'x-access-token',
          password: token,
        };
      },
    });

    repoPath.value = path;
    initialized.value = true;
  }

  // Clone a repository
  async function clone(url: string, options?: { ref?: string; depth?: number }): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      if (!initialized.value) {
        await initialize();
      }

      if (!git.value) {
        throw new Error('Git not initialized');
      }

      // Ensure repo directory exists
      if (!await fsStore.exists(repoPath.value)) {
        await fsStore.mkdir(repoPath.value, { recursive: true });
      }

      await git.value.clone({
        url,
        ref: options?.ref,
        depth: options?.depth,
        singleBranch: true,
      });

      await refreshStatus();
      await refreshBranches();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clone failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Initialize a new repository
  async function init(options?: { defaultBranch?: string }): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      if (!initialized.value) {
        await initialize();
      }

      if (!git.value) {
        throw new Error('Git not initialized');
      }

      // Ensure repo directory exists
      if (!await fsStore.exists(repoPath.value)) {
        await fsStore.mkdir(repoPath.value, { recursive: true });
      }

      await git.value.init(options);
      await refreshBranches();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Init failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Refresh repository status
  async function refreshStatus(): Promise<void> {
    if (!git.value) return;

    try {
      status.value = await git.value.status();
    } catch (err) {
      // Ignore status errors for uninitialized repos
    }
  }

  // Refresh branch list
  async function refreshBranches(): Promise<void> {
    if (!git.value) return;

    try {
      branches.value = await git.value.listBranches();
      currentBranch.value = await git.value.currentBranch();
    } catch (err) {
      // Ignore branch errors for uninitialized repos
    }
  }

  // Stage a file
  async function stage(filepath: string): Promise<void> {
    if (!git.value) {
      throw new Error('Git not initialized');
    }

    await git.value.add(filepath);
    await refreshStatus();
  }

  // Unstage a file
  async function unstage(filepath: string): Promise<void> {
    if (!git.value) {
      throw new Error('Git not initialized');
    }

    await git.value.reset(filepath);
    await refreshStatus();
  }

  // Create a commit
  async function commit(message: string): Promise<string> {
    loading.value = true;
    error.value = null;

    try {
      if (!git.value) {
        throw new Error('Git not initialized');
      }

      const user = authStore.user;
      const sha = await git.value.commit({
        message,
        authorName: user?.name ?? 'Janos User',
        authorEmail: user?.email ?? 'user@janos.app',
      });

      await refreshStatus();
      await loadCommits();

      return sha;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Commit failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Load commit history
  async function loadCommits(options?: { depth?: number }): Promise<void> {
    if (!git.value) return;

    try {
      commits.value = await git.value.log({ depth: options?.depth ?? 20 });
    } catch (err) {
      // Ignore log errors for empty repos
    }
  }

  // Push to remote
  async function push(options?: { remote?: string; ref?: string; force?: boolean }): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      if (!git.value) {
        throw new Error('Git not initialized');
      }

      await git.value.push(options);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Push failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Pull from remote
  async function pull(options?: { remote?: string; ref?: string }): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      if (!git.value) {
        throw new Error('Git not initialized');
      }

      await git.value.pull(options);
      await refreshStatus();
      await loadCommits();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Pull failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Checkout a branch
  async function checkout(ref: string, options?: { create?: boolean }): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      if (!git.value) {
        throw new Error('Git not initialized');
      }

      await git.value.checkout(ref, options);
      await refreshStatus();
      await refreshBranches();
      await loadCommits();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Checkout failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    git,
    initialized,
    loading,
    error,
    repoPath,
    status,
    branches,
    currentBranch,
    commits,

    // Computed
    isRepo,
    hasChanges,
    stagedFiles,
    unstagedFiles,

    // Actions
    initialize,
    clone,
    init,
    refreshStatus,
    refreshBranches,
    stage,
    unstage,
    commit,
    loadCommits,
    push,
    pull,
    checkout,
  };
});
