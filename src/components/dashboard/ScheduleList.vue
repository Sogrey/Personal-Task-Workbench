<script setup lang="ts">
import { computed } from 'vue'
import { formatShortDate, statusLabel, useWorkbenchStore } from '@/stores/workbench'
import { statusBadgeClass } from '@/utils/status'

const store = useWorkbenchStore()

const title = computed(() => {
  const d = new Date(store.selectedDate)
  return `01 日程清单 · ${d.getMonth() + 1}月${d.getDate()}日`
})
</script>

<template>
  <section class="card panel">
    <div class="card-title">
      <span>{{ title }}</span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>任务标题</th>
            <th>项目</th>
            <th>负责人</th>
            <th>对接人</th>
            <th>截止</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(task, idx) in store.todayTasks" :key="task.id">
            <td>{{ idx + 1 }}</td>
            <td>{{ task.title }}</td>
            <td>{{ store.projectById(task.projectId)?.name ?? '—' }}</td>
            <td>{{ task.owner }}</td>
            <td>{{ task.contact || '—' }}</td>
            <td>{{ formatShortDate(task.deadline ?? task.endAt) }}</td>
            <td><span :class="statusBadgeClass(task.status)">{{ statusLabel(task.status) }}</span></td>
          </tr>
          <tr v-if="!store.todayTasks.length">
            <td colspan="7" class="empty-hint">暂无日程</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.panel {
  padding: 16px;
}

.table-wrap {
  overflow: auto;
}
</style>
