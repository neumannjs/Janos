<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const isAuthenticated = computed(() => authStore.isAuthenticated);
const user = computed(() => authStore.user);
const loading = computed(() => authStore.loading);

async function handleLogin() {
  await authStore.login();
}

async function handleLogout() {
  await authStore.logout();
}

function openEditor() {
  router.push('/editor');
}
</script>

<template>
  <div class="home">
    <header class="header">
      <div class="logo">
        <h1>Janos</h1>
        <span class="tagline">Browser-based Static Site Generator</span>
      </div>
      <nav class="nav">
        <template v-if="isAuthenticated">
          <span class="user-info">
            <img
              v-if="user?.avatarUrl"
              :src="user.avatarUrl"
              :alt="user.name"
              class="avatar"
            />
            <span class="username">{{ user?.name }}</span>
          </span>
          <button class="btn btn-secondary" @click="handleLogout" :disabled="loading">
            Logout
          </button>
        </template>
        <template v-else>
          <button class="btn btn-primary" @click="handleLogin" :disabled="loading">
            {{ loading ? 'Loading...' : 'Login with GitHub' }}
          </button>
        </template>
      </nav>
    </header>

    <main class="main">
      <section class="hero">
        <h2>Edit Your Website Anywhere</h2>
        <p>
          Janos runs entirely in your browser. Clone your repository,
          edit your content, and publish - all without installing anything.
        </p>
        <div class="hero-actions">
          <button
            v-if="isAuthenticated"
            class="btn btn-primary btn-large"
            @click="openEditor"
          >
            Open Editor
          </button>
          <button
            v-else
            class="btn btn-primary btn-large"
            @click="handleLogin"
            :disabled="loading"
          >
            Get Started
          </button>
        </div>
      </section>

      <section class="features">
        <div class="feature">
          <h3>Browser-Native</h3>
          <p>No server required. Everything runs in your browser using IndexedDB for storage.</p>
        </div>
        <div class="feature">
          <h3>Git Integration</h3>
          <p>Clone, commit, and push directly to GitHub. Your content stays in your repository.</p>
        </div>
        <div class="feature">
          <h3>IndieWeb Ready</h3>
          <p>Built-in support for webmentions, microformats, and other IndieWeb standards.</p>
        </div>
      </section>
    </main>

    <footer class="footer">
      <p>
        <a href="https://github.com/gvandam/janos" target="_blank" rel="noopener">
          Source on GitHub
        </a>
      </p>
    </footer>
  </div>
</template>

<style scoped>
.home {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.logo h1 {
  font-size: 1.5rem;
  color: var(--color-primary);
  margin-bottom: 0.25rem;
}

.tagline {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.username {
  color: var(--color-text-secondary);
}

.main {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.hero {
  text-align: center;
  padding: 4rem 2rem;
}

.hero h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.25rem;
  color: var(--color-text-secondary);
  max-width: 600px;
  margin: 0 auto 2rem;
}

.hero-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  padding: 2rem 0;
}

.feature {
  background-color: var(--color-bg-secondary);
  padding: 2rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.feature h3 {
  color: var(--color-primary);
  margin-bottom: 0.5rem;
}

.feature p {
  color: var(--color-text-secondary);
}

.footer {
  padding: 2rem;
  text-align: center;
  border-top: 1px solid var(--color-border);
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  border: none;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-secondary {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-border);
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.125rem;
}
</style>
