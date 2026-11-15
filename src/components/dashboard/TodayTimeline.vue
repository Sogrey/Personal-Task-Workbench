<script setup lang="ts">
import { computed } from 'vue'
import { formatTimeRange, statusLabel, useWorkbenchStore } from '@/stores/workbench'
import { statusBadgeClass } from '@/utils/status'

const store = useWorkbenchStore()

const title = computed(() => {
  const d = new Date(store.selectedDate)
  return `今日时间线 · ${d.getMonth() + 1}/${d.getDate()}`
})
</script>

<template>
  <section class="card timeline">
    <div class="card-title">
      <span>{{ title }}</span>
      <span class="muted">{{ store.todayTasks.length }} 项</span>
    </div>

    <div v-if="store.todayTasks.length" class="list">
      <article v-for="task in store.todayTasks" :key="task.id" class="item">
        <div class="time">{{ formatTimeRange(task.startAt, task.endAt) }}</div>
        <div class="body">
          <div class="row">
            <strong>{{ task.title }}</strong>
            <span :class="statusBadgeClass(task.status)">{{ statusLabel(task.status) }}</span>
          </div>
          <div class="meta">
            <span>{{ store.projectById(task.projectId)?.name ?? '未归属项目' }}</span>
            <span>·</span>
            <span>{{ task.owner }}</span>
            <span v-if="store.conflictTaskIds.has(task.id)" class="badge badge-danger">冲突</span>
          </div>
        </div>
      </article>
    </div>
    <div v-else class="empty-hint">当天暂无安排</div>
  </section>
</template>

<style scoped>
.timeline {
  padding: 16px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 320px;
  overflow: auto;
}

.item {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: #f8fafc;
}

.time {
  font-size: 12px;
  color: var(--text-secondary);
  padding-top: 2px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.row strong {
  font-size: 13px;
}

.meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  align-items: center;
}
</style>
