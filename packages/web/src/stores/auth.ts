import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  createGitHubAuth,
  type IAuthProvider,
  type AuthState,
  type AuthUser,
} from '@janos/core';

export const useAuthStore = defineStore('auth', () => {
  // State
  const isAuthenticated = ref(false);
  const user = ref<AuthUser | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Provider instance (lazy initialized)
  let provider: IAuthProvider | null = null;

  // Getters
  const accessToken = computed(() => provider?.getAccessToken() ?? null);
  const isLoading = computed(() => loading.value);
  const authError = computed(() => error.value);

  // Initialize provider
  function initProvider(): IAuthProvider {
    if (!provider) {
      // Get auth worker URL from environment, default to hosted instance
      const authWorkerUrl = import.meta.env.VITE_AUTH_WORKER_URL ?? 'https://janos-auth.workers.dev';

      // Determine the GitHub user and repo from config or URL
      // For now, these can be passed as env vars or derived from the hostname
      const githubUser = import.meta.env.VITE_GITHUB_USER ?? '';
      const githubRepo = import.meta.env.VITE_GITHUB_REPO ?? '';

      // Build authorize URL for the auth worker
      // If user/repo are set, use the auth worker; otherwise fall back to direct GitHub OAuth
      const authorizeUrl = githubUser && githubRepo
        ? `${authWorkerUrl}/authorize/${githubUser}/${githubRepo}`
        : undefined;

      provider = createGitHubAuth({
        type: 'github',
        oauth: {
          clientId: import.meta.env.VITE_GITHUB_CLIENT_ID ?? '',
          redirectUri: `${window.location.origin}/auth/callback`,
          scopes: ['repo', 'read:user', 'user:email'],
          proxyUrl: import.meta.env.VITE_OAUTH_PROXY_URL,
          authorizeUrl,
        },
      });

      // Subscribe to state changes
      provider.subscribe((state) => {
        isAuthenticated.value = state.isAuthenticated;
        user.value = state.user;
      });
    }
    return provider;
  }

  // Actions
  async function login(options?: { popup?: boolean }): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const p = initProvider();
      await p.login(options);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function handleCallback(url: string): Promise<AuthState> {
    loading.value = true;
    error.value = null;

    try {
      const p = initProvider();
      const state = await p.handleCallback(url);
      return state;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Authentication failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const p = initProvider();
      await p.logout();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Logout failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function restore(): Promise<AuthState | null> {
    loading.value = true;
    error.value = null;

    try {
      const p = initProvider();
      const state = await p.restore();
      return state;
    } catch (err) {
      // Ignore restore errors - just means not logged in
      return null;
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    isAuthenticated,
    user,
    loading: isLoading,
    error: authError,
    accessToken,

    // Actions
    login,
    handleCallback,
    logout,
    restore,
  };
});
