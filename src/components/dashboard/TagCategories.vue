<script setup lang="ts">
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()
</script>

<template>
  <section class="card panel">
    <div class="card-title">
      <span>03 标签分类</span>
      <RouterLink class="muted" to="/tags">管理</RouterLink>
    </div>
    <div class="tags">
      <RouterLink
        v-for="tag in store.tagStats"
        :key="tag.id"
        class="tag"
        :to="{ path: '/tasks', query: { tag: tag.id } }"
        :style="{ '--tag': tag.color }"
      >
        <span>{{ tag.name }}</span>
        <strong>{{ tag.count }}</strong>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.panel {
  padding: 16px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tag) 14%, white);
  color: color-mix(in srgb, var(--tag) 75%, black);
  border: 1px solid color-mix(in srgb, var(--tag) 25%, white);
  font-size: 13px;
}

.tag strong {
  font-size: 12px;
}
</style>
