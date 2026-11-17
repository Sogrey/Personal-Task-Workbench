<script setup lang="ts">
import { computed } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()

const items = computed(() => store.reminders.slice(0, 4))
</script>

<template>
  <section class="card panel">
    <div class="card-title">
      <span>02 待处理提醒</span>
      <RouterLink class="muted" to="/reminders">查看全部</RouterLink>
    </div>
    <div class="list">
      <div v-for="item in items" :key="item.id" class="row" :data-severity="item.severity">
        <div class="head">
          <strong>{{ item.title }}</strong>
          <span>{{ item.progress ?? 0 }}%</span>
        </div>
        <div class="bar">
          <i :style="{ width: `${item.progress ?? 0}%` }" />
        </div>
        <p>{{ item.description }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  padding: 16px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
}

.head span {
  color: var(--text-secondary);
  font-size: 12px;
}

.bar {
  height: 8px;
  border-radius: 999px;
  background: #eef2f7;
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--info);
}

.row[data-severity='danger'] .bar i {
  background: var(--danger);
}
.row[data-severity='warning'] .bar i {
  background: var(--warning);
}
.row[data-severity='info'] .bar i {
  background: var(--info);
}

p {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
