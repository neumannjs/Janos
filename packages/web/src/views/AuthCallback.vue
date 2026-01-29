<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const error = ref<string | null>(null);
const processing = ref(true);

onMounted(async () => {
  try {
    // Handle OAuth callback
    await authStore.handleCallback(window.location.href);

    // Close popup if this is a popup window
    if (window.opener) {
      window.opener.postMessage({ type: 'oauth-callback', success: true }, window.location.origin);
      window.close();
    } else {
      // Redirect to editor
      router.push('/editor');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Authentication failed';

    // Notify opener if this is a popup
    if (window.opener) {
      window.opener.postMessage(
        { type: 'oauth-callback', success: false, error: error.value },
        window.location.origin
      );
    }
  } finally {
    processing.value = false;
  }
});

function goHome() {
  router.push('/');
}
</script>

<template>
  <div class="auth-callback">
    <div class="callback-content">
      <div v-if="processing" class="processing">
        <div class="spinner"></div>
        <p>Completing authentication...</p>
      </div>

      <div v-else-if="error" class="error">
        <h2>Authentication Failed</h2>
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="goHome">
          Go Home
        </button>
      </div>

      <div v-else class="success">
        <h2>Authentication Successful</h2>
        <p>Redirecting...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-callback {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.callback-content {
  text-align: center;
  padding: 2rem;
}

.processing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error h2 {
  color: var(--color-error);
  margin-bottom: 1rem;
}

.error p {
  color: var(--color-text-secondary);
  margin-bottom: 2rem;
}

.success h2 {
  color: var(--color-success);
  margin-bottom: 1rem;
}

.success p {
  color: var(--color-text-secondary);
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  filter: brightness(1.1);
}
</style>
