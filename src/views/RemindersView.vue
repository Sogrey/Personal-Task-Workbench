<script setup lang="ts">
import { formatTimeRange, statusLabel, useWorkbenchStore } from '@/stores/workbench'
import { statusBadgeClass } from '@/utils/status'

const store = useWorkbenchStore()
</script>

<template>
  <div class="page">
    <section class="intro card">
      <h2>冲突与提醒</h2>
      <p>逾期任务、即将到期事项、时间冲突集中查看，优先处理风险项。</p>
    </section>

    <div class="reminder-grid">
      <article v-for="item in store.reminders" :key="item.id" class="card rem" :data-severity="item.severity">
        <div class="head">
          <h3>{{ item.title }}</h3>
          <span class="count">{{ item.taskIds.length }}</span>
        </div>
        <p>{{ item.description }}</p>
        <div class="bar"><i :style="{ width: `${item.progress ?? 0}%` }" /></div>
      </article>
    </div>

    <section class="card panel">
      <div class="card-title"><span>逾期任务</span></div>
      <table class="data-table">
        <thead>
          <tr>
            <th>任务</th>
            <th>负责人</th>
            <th>截止</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in store.overdueTasks" :key="task.id">
            <td>{{ task.title }}</td>
            <td>{{ task.owner }}</td>
            <td>{{ task.deadline ?? task.endAt }}</td>
            <td><span :class="statusBadgeClass(task.status)">{{ statusLabel(task.status) }}</span></td>
          </tr>
          <tr v-if="!store.overdueTasks.length">
            <td colspan="4" class="empty-hint">暂无逾期</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="card panel">
      <div class="card-title">
        <span>时间重叠（可并行）</span>
        <span class="muted">仅提醒，任务支持并行处理</span>
      </div>
      <div v-if="store.conflictPairs.length" class="conflicts">
        <article v-for="(pair, idx) in store.conflictPairs" :key="idx" class="conflict">
          <h4>重叠 {{ idx + 1 }} · {{ pair.owner }}</h4>
          <ul>
            <li v-for="task in pair.tasks" :key="task.id">
              <strong>{{ task.title }}</strong>
              <span>{{ formatTimeRange(task.startAt, task.endAt) }}</span>
            </li>
          </ul>
        </article>
      </div>
      <div v-else class="empty-hint">当前无时间重叠</div>
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
.panel,
.rem {
  padding: 18px;
}

.intro h2 {
  margin: 0 0 6px;
}

.intro p,
.rem p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.reminder-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.head h3 {
  margin: 0;
  font-size: 15px;
}

.count {
  min-width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #f3f4f6;
  font-weight: 700;
}

.rem[data-severity='danger'] .count {
  background: var(--danger-soft);
  color: #b91c1c;
}

.rem[data-severity='warning'] .count {
  background: var(--warning-soft);
  color: #b45309;
}

.bar {
  margin-top: 12px;
  height: 8px;
  border-radius: 999px;
  background: #eef2f7;
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--primary);
}

.rem[data-severity='danger'] .bar i {
  background: var(--danger);
}
.rem[data-severity='warning'] .bar i {
  background: var(--warning);
}

.conflicts {
  display: grid;
  gap: 12px;
}

.conflict {
  padding: 12px;
  border-radius: 10px;
  background: var(--warning-soft);
}

.conflict h4 {
  color: #b45309;
  margin: 0 0 8px;
}

.conflict ul {
  margin: 0;
  padding-left: 18px;
}

.conflict li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 4px 0;
  font-size: 13px;
}

@media (max-width: 1100px) {
  .reminder-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
