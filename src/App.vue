<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <div class="main">
      <AppHeader />
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(76, 175, 80, 0.08), transparent 28%),
    linear-gradient(180deg, #f4f7fb 0%, #eef2f6 100%);
}

.main {
  flex: 1;
  min-width: 0;
  padding: 8px 20px 24px;
}

.content {
  min-width: 0;
}
</style>
