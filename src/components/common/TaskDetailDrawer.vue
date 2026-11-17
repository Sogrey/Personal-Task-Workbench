<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { formatTimeRange, priorityLabel, statusLabel, useWorkbenchStore } from '@/stores/workbench'
import type { Task } from '@/types'
import { statusBadgeClass } from '@/utils/status'

defineProps<{ task: Task | null }>()
const emit = defineEmits<{ close: []; edit: [task: Task] }>()

const store = useWorkbenchStore()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

function fmtFull(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="task" class="drawer-root" @mousedown.self="emit('close')">
        <aside class="drawer" role="dialog" aria-label="任务详情">
          <header class="head">
            <div class="head-main">
              <h3>{{ task.title }}</h3>
              <span :class="statusBadgeClass(task.status)">{{ statusLabel(task.status) }}</span>
            </div>
            <button class="close" type="button" aria-label="关闭" @click="emit('close')">✕</button>
          </header>

          <div class="body">
            <section class="group">
              <h4>基本信息</h4>
              <div class="row">
                <span class="k">负责人</span>
                <span class="v">{{ task.owner || '—' }}</span>
              </div>
              <div class="row">
                <span class="k">对接人</span>
                <span class="v">{{ task.contact || '—' }}</span>
              </div>
              <div class="row">
                <span class="k">所属项目</span>
                <span class="v">{{ store.projectById(task.projectId)?.name ?? '未关联' }}</span>
              </div>
              <div class="row">
                <span class="k">优先级</span>
                <span class="v">{{ priorityLabel(task.priority) }}</span>
              </div>
              <div class="row">
                <span class="k">标签</span>
                <span class="v tags">
                  <template v-if="task.tagIds.length">
                    <span
                      v-for="id in task.tagIds"
                      :key="id"
                      class="tag-chip"
                      :style="{ background: store.tagById(id)?.color ?? '#94a3b8' }"
                    >
                      {{ store.tagById(id)?.name ?? id }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </span>
              </div>
              <div v-if="store.conflictTaskIds.has(task.id)" class="warn-tip">
                时间重叠 · 任务可并行，留意安排
              </div>
            </section>

            <section class="group">
              <h4>时间安排</h4>
              <div class="row">
                <span class="k">时间段</span>
                <span class="v">{{ formatTimeRange(task.startAt, task.endAt) }}（跨天任务见下方具体时刻）</span>
              </div>
              <div class="row">
                <span class="k">开始</span>
                <span class="v">{{ fmtFull(task.startAt) }}</span>
              </div>
              <div class="row">
                <span class="k">结束</span>
                <span class="v">{{ fmtFull(task.endAt) }}</span>
              </div>
              <div class="row">
                <span class="k">截止</span>
                <span class="v">{{ fmtFull(task.deadline) }}</span>
              </div>
            </section>

            <section class="group">
              <h4>备注</h4>
              <p v-if="task.description" class="desc">{{ task.description }}</p>
              <p v-else class="desc muted">暂无备注</p>
            </section>

            <section class="group">
              <h4>其他信息</h4>
              <div class="row">
                <span class="k">创建时间</span>
                <span class="v">{{ fmtFull(task.createdAt) }}</span>
              </div>
              <div class="row">
                <span class="k">最后更新</span>
                <span class="v">{{ fmtFull(task.updatedAt) }}</span>
              </div>
            </section>
          </div>

          <footer class="foot">
            <select
              class="status-select"
              :value="task.status"
              @change="store.updateTaskStatus(task.id, ($event.target as HTMLSelectElement).value as Task['status'])"
            >
              <option value="pending">待处理</option>
              <option value="in_progress">进行中</option>
              <option value="to_confirm">待确认</option>
              <option value="done">已完成</option>
            </select>
            <button class="btn btn-primary" type="button" @click="emit('edit', task)">编辑任务</button>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-root {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(15, 23, 42, 0.32);
}

.drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 92vw);
  background: #fff;
  box-shadow: -12px 0 40px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
}

.head-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.head h3 {
  margin: 0;
  font-size: 17px;
  line-height: 1.4;
  word-break: break-all;
}

.close {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 8px;
  flex-shrink: 0;
}

.close:hover {
  background: #f1f5f9;
  color: var(--text);
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 20px 16px;
}

.group {
  padding: 14px 0;
  border-bottom: 1px dashed var(--border);
}

.group:last-child {
  border-bottom: none;
}

.group h4 {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
}

.row {
  display: flex;
  gap: 14px;
  padding: 4px 0;
  font-size: 13px;
}

.k {
  width: 64px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 12px;
  padding-top: 1px;
}

.v {
  flex: 1;
  word-break: break-all;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 0;
}

.tag-chip {
  font-size: 11px;
  color: #fff;
  border-radius: 999px;
  padding: 1px 8px;
}

.warn-tip {
  margin-top: 10px;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--warning-soft);
  color: #b45309;
  font-size: 12px;
}

.desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f8fafc;
  border-radius: 10px;
  padding: 10px 12px;
}

.desc.muted {
  color: var(--text-secondary);
  background: transparent;
}

.foot {
  display: flex;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}

.foot .status-select {
  flex: 1;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  padding: 0 10px;
}

.foot .btn {
  height: 34px;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.18s ease;
}

.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 0.22s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(100%);
}
</style>
