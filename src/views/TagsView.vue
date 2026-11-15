<script setup lang="ts">
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()
</script>

<template>
  <div class="page">
    <section class="intro card">
      <h2>标签分类</h2>
      <p>客户相关、重要紧急、会议事项、后续跟进——不同任务分类管理，点击标签即可筛选。</p>
    </section>

    <div class="grid">
      <RouterLink
        v-for="tag in store.tagStats"
        :key="tag.id"
        class="card tag-card"
        :to="{ path: '/tasks', query: { tag: tag.id } }"
        :style="{ '--tag': tag.color }"
      >
        <div class="dot" />
        <div>
          <h3>{{ tag.name }}</h3>
          <p>未完成任务 <strong>{{ tag.count }}</strong> 项</p>
        </div>
      </RouterLink>
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
}

.intro p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.tag-card {
  padding: 18px;
  display: flex;
  gap: 14px;
  align-items: center;
  transition: 0.15s ease;
}

.tag-card:hover {
  transform: translateY(-2px);
}

.dot {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--tag);
  opacity: 0.9;
}

h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
