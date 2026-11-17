<script setup lang="ts">
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()
</script>

<template>
  <div class="page">
    <section class="intro card">
      <h2>历史记录</h2>
      <p>任务调整、时间变更、负责人修改都会留下痕迹，方便回顾「为什么改、改成了什么」。</p>
    </section>

    <section class="card panel">
      <div class="card-title">
        <span>调整流水</span>
        <span class="muted">共 {{ store.history.length }} 条</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>任务名称</th>
              <th>调整内容</th>
              <th>原值</th>
              <th>新值</th>
              <th>变更原因</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in store.history" :key="row.id">
            <td>{{ row.time }}</td>
            <td>
              <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: row.taskId } }" :title="`查看「${row.taskTitle}」详情`">
                {{ row.taskTitle }}
              </RouterLink>
            </td>
              <td>{{ row.field }}</td>
              <td>{{ row.oldValue }}</td>
              <td>{{ row.newValue }}</td>
              <td>{{ row.reason ?? '—' }}</td>
            </tr>
            <tr v-if="!store.history.length">
              <td colspan="6" class="empty-hint">暂无调整记录，任务状态变化与新建会自动留痕</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.intro,
.panel {
  padding: 18px;
}

.intro h2 {
  margin: 0 0 6px;
}

.intro p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.table-wrap {
  overflow: auto;
}
</style>
