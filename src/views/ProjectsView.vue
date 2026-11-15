<script setup lang="ts">
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()
</script>

<template>
  <div class="page">
    <section class="intro card">
      <div>
        <h2>项目进度</h2>
        <p>不同项目做到哪一步、还有多少事情没完成，不用反复翻表格。</p>
      </div>
    </section>

    <div class="grid">
      <article v-for="project in store.projects" :key="project.id" class="card project">
        <div class="head">
          <h3>{{ project.name }}</h3>
          <span class="badge badge-success">进行中</span>
        </div>
        <p>{{ project.description }}</p>
        <div class="metrics">
          <div>
            <span>进度</span>
            <strong>{{ project.progress }}%</strong>
          </div>
          <div>
            <span>关联任务</span>
            <strong>{{ store.tasksByProject(project.id).length }}</strong>
          </div>
          <div>
            <span>未完成</span>
            <strong>{{ store.unfinishedByProject(project.id) }}</strong>
          </div>
        </div>
        <div class="bar">
          <i :style="{ width: `${project.progress}%` }" />
        </div>
        <RouterLink class="link" :to="{ path: '/tasks', query: { q: project.name } }">
          查看任务 →
        </RouterLink>
      </article>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.intro {
  padding: 18px 20px;
}

.intro h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.intro p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.project {
  padding: 18px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.head h3 {
  margin: 0;
  font-size: 16px;
}

.project > p {
  margin: 10px 0 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.metrics span {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
}

.metrics strong {
  font-size: 18px;
}

.bar {
  height: 10px;
  border-radius: 999px;
  background: #eef2f7;
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #66bb6a, #43a047);
}

.link {
  display: inline-block;
  margin-top: 14px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
