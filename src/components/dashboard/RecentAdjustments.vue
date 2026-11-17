<script setup lang="ts">
import { computed } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()
const rows = computed(() => store.history.slice(0, 6))
</script>

<template>
  <section class="card panel">
    <div class="card-title">
      <span>04 最近调整记录</span>
      <RouterLink class="muted" to="/history">全部记录</RouterLink>
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
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.time }}</td>
            <td>{{ row.taskTitle }}</td>
            <td>{{ row.field }}</td>
            <td>{{ row.oldValue }}</td>
            <td>{{ row.newValue }}</td>
            <td>{{ row.reason ?? '—' }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="6" class="empty-hint">暂无调整记录</td>
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
