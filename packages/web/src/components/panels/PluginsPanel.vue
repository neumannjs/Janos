<script setup lang="ts">
import { NIcon } from 'naive-ui';
import { ExtensionPuzzleOutline } from '@vicons/ionicons5';
</script>

<template>
  <div class="plugins-panel">
    <div class="coming-soon">
      <NIcon :size="48" :depth="3">
        <ExtensionPuzzleOutline />
      </NIcon>
      <h3>Plugin Management</h3>
      <p>
        Configure and manage pipeline plugins for your site.
        Enable, disable, and customize plugin options.
      </p>
      <p class="coming-soon-text">Coming in Phase 7</p>
    </div>
  </div>
</template>

<style scoped>
.plugins-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.coming-soon {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--color-text-secondary);
}

.coming-soon h3 {
  margin: 16px 0 8px;
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text);
}

.coming-soon p {
  font-size: 13px;
  max-width: 200px;
  line-height: 1.5;
}

.coming-soon-text {
  margin-top: 16px;
  padding: 4px 12px;
  background-color: var(--color-bg-tertiary);
  border-radius: 12px;
  font-size: 12px;
  color: var(--color-primary);
}
</style>
