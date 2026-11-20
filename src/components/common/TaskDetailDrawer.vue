<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { formatTimeRange, priorityLabel, statusLabel, useWorkbenchStore } from '@/stores/workbench'
import type { Task } from '@/types'
import { overdueDays } from '@/utils/date'
import { statusBadgeClass, TASK_STATUS_OPTIONS } from '@/utils/status'

const props = defineProps<{ task: Task | null }>()
const emit = defineEmits<{ close: []; edit: [task: Task]; delete: [task: Task]; goto: [task: Task] }>()

const store = useWorkbenchStore()

/** 当前任务的最近进展说明（响应式：任务切换/更新自动刷新） */
const latestNote = computed(() => {
  return props.task ? store.latestProgressNote(props.task.id) : undefined
})

/** BK-15：父任务（独立任务无） */
const parentTask = computed(() => {
  const pid = props.task?.parentId
  return pid ? (store.tasks.find((t) => t.id === pid) ?? undefined) : undefined
})

/** BK-15：子任务清单（含已取消，按开始时间排序） */
const children = computed(() => {
  if (!props.task) return []
  return [...store.childTasks(props.task.id)].sort((a, b) => a.startAt.localeCompare(b.startAt))
})
const childDoneCount = computed(() => children.value.filter((t) => t.status === 'done').length)

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
    <!-- appear：URL 直达（?task=id）挂载即有值时也播放展开动画 -->
    <Transition name="drawer" appear>
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
                <span class="v">
                  <RouterLink
                    v-if="task.projectId"
                    class="text-link"
                    :to="{ path: '/tasks', query: { projectId: task.projectId } }"
                    :title="`查看项目「${store.projectById(task.projectId)?.name}」下的任务`"
                  >
                    {{ store.projectById(task.projectId)?.name }}
                  </RouterLink>
                  <template v-else>未关联</template>
                </span>
              </div>
              <div v-if="parentTask" class="row">
                <span class="k">父任务</span>
                <span class="v">
                  <button
                    class="text-link"
                    type="button"
                    :title="`查看「${parentTask.title}」详情`"
                    @click="emit('goto', parentTask)"
                  >
                    {{ parentTask.title }}
                  </button>
                </span>
              </div>
              <div class="row">
                <span class="k">优先级</span>
                <span class="v">{{ priorityLabel(task.priority) }}</span>
              </div>
              <div class="row">
                <span class="k">标签</span>
                <span class="v tags">
                  <template v-if="task.tagIds.length">
                    <RouterLink
                      v-for="id in task.tagIds"
                      :key="id"
                      class="tag-chip"
                      :to="{ path: '/tasks', query: { tag: id } }"
                      :style="{ background: store.tagById(id)?.color ?? '#94a3b8' }"
                      :title="`按标签「${store.tagById(id)?.name ?? id}」筛选任务`"
                    >
                      {{ store.tagById(id)?.name ?? id }}
                    </RouterLink>
                  </template>
                  <template v-else>—</template>
                </span>
              </div>
              <div v-if="store.conflictTaskIds.has(task.id)" class="warn-tip">
                时间重叠 · 任务可并行，留意安排
              </div>
              <div v-if="task.delayed || task.status === 'delayed'" class="warn-tip danger-tip">
                已确认延期 · {{ task.delayNote || '未按计划开始' }}
              </div>
            </section>

            <section class="group">
              <h4>时间安排</h4>
              <div class="row">
                <span class="k">计划时段</span>
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
              <!-- BK-20：真实执行时间——切「进行中」自动记实际开始（含提前开始） -->
              <div v-if="task.actualStart" class="row">
                <span class="k">实际开始</span>
                <span class="v">{{ fmtFull(task.actualStart) }}</span>
              </div>
              <!-- FIX-6：逾期派生提示（不写库），已完成/已取消/延期处理不显示 -->
              <div v-if="overdueDays(task, store.today) > 0" class="warn-tip danger-tip">
                已逾期 {{ overdueDays(task, store.today) }} 天 · 截止 {{ fmtFull(task.deadline ?? task.endAt) }}
              </div>
              <div v-if="task.completedAt" class="row">
                <span class="k">实际完成</span>
                <span class="v done-text">{{ fmtFull(task.completedAt) }}</span>
              </div>
            </section>

            <!-- BK-15：子任务清单（父任务展示） -->
            <section v-if="children.length" class="group">
              <h4>子任务（{{ childDoneCount }}/{{ children.length }} 已完成）</h4>
              <div class="child-list">
                <button
                  v-for="c in children"
                  :key="c.id"
                  class="child-item"
                  type="button"
                  :title="`查看「${c.title}」详情`"
                  @click="emit('goto', c)"
                >
                  <span :class="statusBadgeClass(c.status)">{{ statusLabel(c.status) }}</span>
                  <span class="child-name">{{ c.title }}</span>
                </button>
              </div>
            </section>

            <section v-if="latestNote" class="group">
              <h4>最近进展</h4>
              <p class="desc note-text">{{ latestNote }}</p>
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
              <option v-for="opt in TASK_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <button class="btn btn-ghost delete-action" type="button" @click="emit('delete', task)">
              删除任务
            </button>
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
  cursor: pointer;
}

.tag-chip:hover {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
}

.warn-tip.danger-tip {
  background: var(--danger-soft);
  color: #b91c1c;
}

.done-text {
  color: #047857;
  font-weight: 600;
}

.note-text {
  white-space: normal;
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

.delete-action {
  color: var(--danger);
}

/* BK-15：父任务链接与子任务清单 */
.child-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.child-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #f8fafc;
  padding: 8px 10px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
}

.child-item:hover {
  border-color: var(--primary);
  background: #fff;
}

.child-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
