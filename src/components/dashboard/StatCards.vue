<script setup lang="ts">
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()
</script>

<template>
  <section class="stats">
    <article v-for="item in store.stats" :key="item.key" class="card stat" :data-tone="item.tone">
      <div class="meta">
        <div class="label">{{ item.label }}</div>
        <div class="value">{{ item.value }}</div>
        <div v-if="item.hint" class="hint">{{ item.hint }}</div>
      </div>
      <div class="icon-wrap" aria-hidden="true" />
    </article>
  </section>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.stat {
  padding: 16px 18px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  min-height: 96px;
}

.label {
  font-size: 13px;
  color: var(--text-secondary);
}

.value {
  margin-top: 8px;
  font-size: 32px;
  font-weight: 750;
  line-height: 1;
}

.hint {
  margin-top: 8px;
  font-size: 12px;
  color: #16a34a;
}

.icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--primary-soft);
}

.stat[data-tone='info'] .icon-wrap {
  background: var(--info-soft);
}
.stat[data-tone='warning'] .value {
  color: #d97706;
}
.stat[data-tone='warning'] .icon-wrap {
  background: var(--warning-soft);
}
.stat[data-tone='danger'] .value {
  color: #dc2626;
}
.stat[data-tone='danger'] .icon-wrap {
  background: var(--danger-soft);
}
.stat[data-tone='success'] .icon-wrap {
  background: var(--success-soft);
}

@media (max-width: 1100px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
