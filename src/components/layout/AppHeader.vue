<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()
const router = useRouter()
const keyword = ref('')

const dateText = computed(() => {
  const d = new Date(store.today)
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 周${week}`
})

function onSearch() {
  const q = keyword.value.trim()
  if (!q) return
  router.push({ path: '/tasks', query: { q } })
}
</script>

<template>
  <header class="header">
    <div class="titles">
      <h1>任务安排工作台</h1>
      <p>把零散工作集中管理 · 按优先级与时间推进</p>
    </div>

    <div class="search">
      <input
        v-model="keyword"
        type="search"
        placeholder="搜索任务、项目、标签或负责人"
        @keydown.enter="onSearch"
      />
      <button class="btn btn-primary" type="button" @click="onSearch">搜索</button>
    </div>

    <div class="right">
      <button class="icon-btn" type="button" title="通知" @click="router.push('/reminders')">
        <span class="bell" />
        <span v-if="store.reminderBadgeCount" class="dot">{{ store.reminderBadgeCount }}</span>
      </button>
      <div class="date">{{ dateText }}</div>
      <div class="avatar" title="我">我</div>
    </div>
  </header>
</template>

<style scoped>
.header {
  min-height: var(--header-height);
  display: grid;
  grid-template-columns: minmax(200px, 1.1fr) minmax(240px, 1.4fr) auto;
  gap: 16px;
  align-items: center;
  padding: 12px 4px 18px;
}

.titles h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 750;
  letter-spacing: 0.02em;
}

.titles p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.search {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search input {
  flex: 1;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0 14px;
  background: #fff;
  outline: none;
}

.search input:focus {
  border-color: #86efac;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.12);
}

.right {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}

.icon-btn {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: #fff;
  display: grid;
  place-items: center;
}

.bell {
  width: 16px;
  height: 16px;
  background: #64748b;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9'/%3E%3Cpath d='M13.73 21a2 2 0 01-3.46 0'/%3E%3C/svg%3E")
    center / contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9'/%3E%3Cpath d='M13.73 21a2 2 0 01-3.46 0'/%3E%3C/svg%3E")
    center / contain no-repeat;
}

.dot {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.date {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #81c784, #43a047);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 13px;
}

@media (max-width: 1100px) {
  .header {
    grid-template-columns: 1fr;
  }
}
</style>
