<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useWorkbenchStore } from '@/stores/workbench'

const route = useRoute()
const store = useWorkbenchStore()

const menus = computed(() => [
  { to: '/', label: '工作总览', icon: 'overview' },
  { to: '/tasks', label: '任务管理', icon: 'tasks' },
  { to: '/projects', label: '项目管理', icon: 'projects' },
  { to: '/schedule', label: '日程安排', icon: 'schedule' },
  { to: '/tags', label: '标签分类', icon: 'tags' },
  { to: '/reminders', label: '冲突与提醒', icon: 'reminders', badge: store.reminderBadgeCount },
  { to: '/history', label: '历史记录', icon: 'history' },
  { to: '/report', label: '工作报告', icon: 'report' },
  { to: '/settings', label: '系统设置', icon: 'settings' },
])

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">任</div>
      <div>
        <div class="brand-title">任务管理</div>
        <div class="brand-sub">Personal Workbench</div>
      </div>
    </div>

    <nav class="nav">
      <RouterLink
        v-for="item in menus"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        :class="{ active: isActive(item.to) }"
      >
        <svg v-if="item.icon === 'overview'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <svg v-else-if="item.icon === 'tasks'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
        <svg v-else-if="item.icon === 'projects'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <svg v-else-if="item.icon === 'schedule'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <svg v-else-if="item.icon === 'tags'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <circle cx="7" cy="7" r="1.5" />
        </svg>
        <svg v-else-if="item.icon === 'reminders'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        <svg v-else-if="item.icon === 'history'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v5h5" />
          <path d="M3.05 13A9 9 0 103 5.8L3 8" />
          <path d="M12 7v5l3 3" />
        </svg>
        <svg v-else-if="item.icon === 'report'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
        <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
        <span class="label">{{ item.label }}</span>
        <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
      </RouterLink>
    </nav>

    <div class="footer-quote">
      <p>事情还是那些事情，</p>
      <p>但不必再靠脑子全记住。</p>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  /* 固定视口高度：避免被 flex stretch 拉到整个文档高、导致 sticky 失效跟着页面滚动 */
  height: 100vh;
  background: linear-gradient(180deg, #243041 0%, #1b2430 100%);
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  padding: 20px 14px;
  position: sticky;
  top: 0;
  flex-shrink: 0;
  /* 窗口过矮时导航自身滚动，不撑爆 */
  overflow-y: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 22px;
}

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #66bb6a, #43a047);
  color: #fff;
  font-weight: 700;
}

.brand-title {
  color: #fff;
  font-weight: 700;
  font-size: 15px;
}

.brand-sub {
  font-size: 11px;
  opacity: 0.65;
  margin-top: 2px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--sidebar-text);
  transition: 0.15s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.nav-item.active {
  background: rgba(76, 175, 80, 0.18);
  color: #fff;
  box-shadow: inset 3px 0 0 #4caf50;
}

.icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  opacity: 0.9;
}

.label {
  flex: 1;
  font-size: 14px;
}

.nav-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-grid;
  place-items: center;
}

.footer-quote {
  margin-top: auto;
  padding: 14px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.55);
}

.footer-quote p {
  margin: 0;
}
</style>
