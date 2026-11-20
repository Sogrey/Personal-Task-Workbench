<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { statusLabel, useWorkbenchStore } from '@/stores/workbench'
import type { Task } from '@/types'
import { CONFLICT_COLOR, STATUS_COLORS, statusBadgeClass } from '@/utils/status'
import { formatRangeSmart, overdueDays, toLocalDateKey } from '@/utils/date'

const store = useWorkbenchStore()

const HOUR_START = 8
const HOUR_END = 18
const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)

const weekLabel = computed(() => {
  const days = store.weekDays
  const a = days[0]
  const b = days[6]
  if (!a || !b) return ''
  return `${a.getMonth() + 1}月${a.getDate()}日 – ${b.getMonth() + 1}月${b.getDate()}日`
})

const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 色块配色：状态专属色（待处理蓝/进行中绿/待确认紫/已完成灰度）；
 *  时间重叠固定橙色且优先；已完成叠加文字灰度 */
function blockColors(task: Task, conflict: boolean) {
  const done = task.status === 'done'
  const color = conflict ? CONFLICT_COLOR : (STATUS_COLORS[task.status] ?? STATUS_COLORS.pending)
  const bg = done ? 'rgba(148, 163, 184, 0.16)' : conflict ? 'rgba(245,158,11,0.14)' : `${color}22`
  return { color, background: bg }
}

/** 布局后的色块：同一天时间重叠的任务阶梯层叠（左错右齐），上层块置顶可读；
 *  cluster 为该块所属重叠簇的全部任务（点击色块时展开该簇完整列表，解决下层块收不到鼠标事件的问题）
 *  FIX-4：跨天任务按覆盖日期逐日渲染，跨天块带 crossDay 标记与当日时段 */
interface LaidBlock {
  task: Task
  top: string
  height: string
  left: string
  width: string
  zIndex: number
  conflict: boolean
  done: boolean
  color: string
  background: string
  cluster: Task[]
  badge: boolean
  /** FIX-4：跨天延续块 */
  crossDay: boolean
  /** 当日时段（clamp 到时间轴内），跨天块尾附标记 */
  dayRangeText: string
}

function dayKey(d: Date) {
  return toLocalDateKey(d)
}

function isToday(d: Date) {
  return dayKey(d) === store.today
}

/** 簇 + 列分配：重叠链归为一簇，簇内列号决定层叠偏移（列 i 左偏 i*12px，右缘对齐）
 *  上层块几乎全宽可读，下层块时间不同处自然露出，hover 置顶 */
const STACK_STEP_PX = 12

function layoutDay(tasks: Task[], day: Date): LaidBlock[] {
  const dayStr = dayKey(day)
  const sorted = [...tasks].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
  const result: LaidBlock[] = []
  // BK-19：已完成任务（含提前完成）不参与重叠簇——不叠块、不计「+N」、不进「时间重叠」面板；
  // 与冲突口径一致（已完成不再算时间重叠），平铺底层灰显供对照
  const doneTasks = sorted.filter((t) => t.status === 'done')
  const activeSorted = sorted.filter((t) => t.status !== 'done')
  for (const task of doneTasks) pushBlock(task, 0, [task], false, 0)
  let cluster: Task[] = []
  let clusterEnd = 0

  /** 任务在当日时间轴内的起止分钟（FIX-4：跨天任务 clamp 到当天轴内） */
  function effectiveRange(task: Task) {
    const start = new Date(task.startAt)
    const end = new Date(task.endAt)
    const dayStart = new Date(day)
    dayStart.setHours(HOUR_START, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(HOUR_END, 0, 0, 0)
    const effStart = start < dayStart ? dayStart : start
    const effEnd = end > dayEnd ? dayEnd : end
    const total = (HOUR_END - HOUR_START) * 60
    const startMin = Math.max(0, Math.min(total, (effStart.getHours() - HOUR_START) * 60 + effStart.getMinutes()))
    const endMin = Math.max(0, Math.min(total, (effEnd.getHours() - HOUR_START) * 60 + effEnd.getMinutes()))
    const crossDay = dayKey(start) !== dayKey(end)
    // 跨天任务在当日轴内的区间：起点日 → 当日全天延续；中间日 → 全天；尾日 → 截止当日某时
    const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    let dayRangeText = `${hm(effStart)}–${hm(effEnd)}`
    if (crossDay) {
      const isStartDay = dayKey(start) === dayStr
      const isEndDay = dayKey(end) === dayStr
      if (isStartDay && !isEndDay) dayRangeText = `${hm(effStart)}–${hm(dayEnd)} ⇢`
      else if (!isStartDay && isEndDay) dayRangeText = `⇠ ${hm(dayStart)}–${hm(effEnd)}`
      else dayRangeText = `⇠ 全天 ⇢`
    }
    return { startMin, endMin, crossDay, dayRangeText }
  }

  function pushBlock(task: Task, colIndex: number, clusterTasks: Task[], showBadge: boolean, baseZ = 1) {
    const { startMin, endMin, crossDay, dayRangeText } = effectiveRange(task)
    const total = (HOUR_END - HOUR_START) * 60
    const top = Math.max(0, (startMin / total) * 100)
    const height = Math.max(6, ((endMin - startMin) / total) * 100)
    const leftPx = 4 + colIndex * STACK_STEP_PX
    const rightPx = 4
    const conflict = store.conflictTaskIds.has(task.id)
    const { color, background } = blockColors(task, conflict)
    result.push({
      task,
      top: `${top}%`,
      height: `${height}%`,
      left: `${leftPx}px`,
      width: `calc(100% - ${leftPx + rightPx}px)`,
      zIndex: colIndex + baseZ,
      conflict,
      done: task.status === 'done',
      color,
      background,
      cluster: clusterTasks,
      badge: showBadge,
      crossDay,
      dayRangeText,
    })
  }

  function flush() {
    if (!cluster.length) return
    const clusterTasks = [...cluster]
    if (cluster.length === 1) {
      pushBlock(cluster[0]!, 0, clusterTasks, false)
    } else {
      // 每列记录占用结束时间，找第一个已空闲的列复用，否则新开一列（列号即层号）
      const colEnds: number[] = []
      const colOf = new Map<string, number>()
      for (const task of cluster) {
        const s = +new Date(task.startAt)
        const e = +new Date(task.endAt)
        let idx = colEnds.findIndex((end) => end <= s)
        if (idx < 0) {
          idx = colEnds.length
          colEnds.push(e)
        } else {
          colEnds[idx] = e
        }
        colOf.set(task.id, idx)
      }
      // 「+N」徽章：给最高层的块（列号最大；并列时取最后处理的）
      const maxCol = Math.max(...colOf.values())
      let badgeAssigned = false
      for (let i = cluster.length - 1; i >= 0; i--) {
        const task = cluster[i]!
        const idx = colOf.get(task.id) ?? 0
        const showBadge = !badgeAssigned && idx === maxCol
        if (showBadge) badgeAssigned = true
        pushBlock(task, idx, clusterTasks, showBadge)
      }
    }
    cluster = []
    clusterEnd = 0
  }

  for (const task of activeSorted) {
    const s = +new Date(task.startAt)
    const e = +new Date(task.endAt)
    if (cluster.length && s >= clusterEnd) flush()
    cluster.push(task)
    clusterEnd = Math.max(clusterEnd, e)
  }
  flush()
  return result
}
const laidByDay = computed(() => {
  const map = new Map<string, LaidBlock[]>()
  for (const day of store.weekDays) {
    const key = dayKey(day)
    // FIX-4：按「覆盖日期」归列——开始日 ≤ 当日 ≤ 结束日，跨天任务逐日延续显示
    const dayTasks = store.weekTasks.filter(
      (t) => t.startAt.slice(0, 10) <= key && t.endAt.slice(0, 10) >= key,
    )
    map.set(key, layoutDay(dayTasks, day))
  }
  return map
})

function blocksForDay(d: Date) {
  return laidByDay.value.get(dayKey(d)) ?? []
}

function selectDay(d: Date) {
  store.setSelectedDate(dayKey(d))
}

/** E 方案：自定义悬浮信息卡（替代原生 title，窄块也能看全量信息） */
interface HoverCard {
  block: LaidBlock
  x: number
  y: number
}

const hoverCard = ref<HoverCard | null>(null)
let showTimer: number | undefined

function onBlockEnter(e: MouseEvent, block: LaidBlock) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  window.clearTimeout(showTimer)
  showTimer = window.setTimeout(() => {
    hoverCard.value = {
      block,
      x: Math.max(8, Math.min(rect.right + 8, window.innerWidth - 286)),
      y: Math.max(8, Math.min(rect.top, window.innerHeight - 230)),
    }
  }, 250)
}

function onBlockLeave() {
  window.clearTimeout(showTimer)
  hoverCard.value = null
}

/** 点击色块：鼠标右侧展开该重叠簇的完整任务列表（下层块收不到 hover，用点击补齐） */
interface ClickPanel {
  tasks: Task[]
  currentId: string
  x: number
  y: number
}

const clickPanel = ref<ClickPanel | null>(null)
const router = useRouter()

function onBlockClick(e: MouseEvent, block: LaidBlock) {
  e.stopPropagation()
  window.clearTimeout(showTimer)
  hoverCard.value = null
  // BK-19：已完成任务（含提前完成）不算时间重叠——点击直接查看详情，不弹「时间重叠」面板
  if (block.task.status === 'done') {
    openTaskDetail(block.task)
    return
  }
  const tasks = [...block.cluster].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
  const panelH = Math.min(120 + tasks.length * 64, 420)
  clickPanel.value = {
    tasks,
    currentId: block.task.id,
    x: Math.max(8, Math.min(e.clientX + 16, window.innerWidth - 316)),
    y: Math.max(8, Math.min(e.clientY - 12, window.innerHeight - panelH - 16)),
  }
}

function closePanel() {
  clickPanel.value = null
}

function openTaskDetail(task: Task) {
  clickPanel.value = null
  router.push({ path: '/tasks', query: { task: task.id } })
}

function onGlobalPointerDown(e: MouseEvent) {
  if (!clickPanel.value) return
  const panelEl = document.querySelector('.click-panel')
  if (panelEl?.contains(e.target as Node)) return
  closePanel()
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closePanel()
}

onMounted(() => {
  document.addEventListener('mousedown', onGlobalPointerDown)
  document.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onGlobalPointerDown)
  document.removeEventListener('keydown', onGlobalKeydown)
  window.clearTimeout(showTimer)
})
</script>

<template>
  <section class="card weekly">
    <div class="card-title">
      <span>周日程安排</span>
      <div class="tools">
        <span class="muted">{{ weekLabel }}</span>
        <button class="btn btn-ghost" type="button" @click="store.shiftWeek(-1)">‹</button>
        <button class="btn" type="button" @click="store.goTodayWeek()">今天</button>
        <button class="btn btn-ghost" type="button" @click="store.shiftWeek(1)">›</button>
      </div>
    </div>

    <div class="grid-wrap">
      <div class="time-col">
        <div class="corner" />
        <div v-for="h in hours" :key="h" class="time-cell">
          {{ String(h).padStart(2, '0') }}:00
        </div>
      </div>

      <div
        v-for="(day, idx) in store.weekDays"
        :key="dayKey(day)"
        class="day-col"
        :class="{ today: isToday(day), selected: dayKey(day) === store.selectedDate }"
        @click="selectDay(day)"
      >
        <div class="day-head">
          <div>{{ weekdayNames[idx] }}</div>
          <strong>{{ day.getDate() }}</strong>
        </div>
        <div class="day-body">
          <div v-for="h in hours" :key="h" class="slot" />
          <div
            v-for="block in blocksForDay(day)"
            :key="block.task.id"
            class="block"
            :class="{ conflict: block.conflict, done: block.done }"
            :style="{
              top: block.top,
              height: block.height,
              left: block.left,
              width: block.width,
              zIndex: block.zIndex,
              background: block.background,
              borderColor: block.color,
            }"
            @mouseenter="onBlockEnter($event, block)"
            @mouseleave="onBlockLeave"
            @click="onBlockClick($event, block)"
          >
            <span v-if="block.badge" class="stack-badge" title="点击查看全部重叠任务">+{{ block.cluster.length - 1 }}</span>
            <div class="block-title">
              {{ block.task.title
              }}<span v-if="block.crossDay" class="cross-tag">跨天</span><span
                v-if="overdueDays(block.task, store.today) > 0"
                class="overdue-tag"
                >逾期{{ overdueDays(block.task, store.today) }}天</span
              >
            </div>
            <div class="block-meta">{{ block.dayRangeText }}</div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="hoverCard"
      class="hover-card"
      :style="{ left: `${hoverCard.x}px`, top: `${hoverCard.y}px` }"
    >
      <div class="hc-head">
        <strong>{{ hoverCard.block.task.title }}</strong>
        <span :class="statusBadgeClass(hoverCard.block.task.status)">
          {{ statusLabel(hoverCard.block.task.status) }}
        </span>
      </div>
      <div class="hc-row">
        <span>时间</span>
        <span>{{ formatRangeSmart(hoverCard.block.task.startAt, hoverCard.block.task.endAt) }}</span>
      </div>
      <div class="hc-row">
        <span>负责人</span>
        <span>
          {{ hoverCard.block.task.owner }}
          <template v-if="hoverCard.block.task.contact"> · 对接：{{ hoverCard.block.task.contact }}</template>
        </span>
      </div>
      <div class="hc-row">
        <span>项目</span>
        <span>{{ store.projectById(hoverCard.block.task.projectId)?.name ?? '未关联' }}</span>
      </div>
      <div v-if="hoverCard.block.task.description" class="hc-desc">{{ hoverCard.block.task.description }}</div>
      <div v-if="hoverCard.block.conflict" class="hc-warn">时间重叠 · 任务可并行，留意安排</div>
    </div>

    <!-- 点击色块展开的重叠簇任务列表：下层块收不到 hover，点击任一层都能看全量 -->
    <div
      v-if="clickPanel"
      class="click-panel"
      :style="{ left: `${clickPanel.x}px`, top: `${clickPanel.y}px` }"
    >
      <div class="cp-head">
        <strong>时间重叠 · {{ clickPanel.tasks.length }} 项</strong>
        <button class="cp-close" type="button" aria-label="关闭" @click="closePanel">✕</button>
      </div>
      <ul class="cp-list">
        <li
          v-for="task in clickPanel.tasks"
          :key="task.id"
          :class="{ current: task.id === clickPanel.currentId }"
          @click="openTaskDetail(task)"
        >
          <div class="cp-main">
            <strong>{{ task.title }}</strong>
            <span :class="statusBadgeClass(task.status)">{{ statusLabel(task.status) }}</span>
          </div>
          <div class="cp-meta">
            {{ formatRangeSmart(task.startAt, task.endAt) }} · {{ task.owner }}
            <template v-if="task.contact"> · 对接：{{ task.contact }}</template>
            · {{ store.projectById(task.projectId)?.name ?? '未关联' }}
          </div>
          <div v-if="task.description" class="cp-note">{{ task.description }}</div>
        </li>
      </ul>
      <div class="cp-tip">点击条目可在任务管理页展开详情</div>
    </div>
  </section>
</template>

<style scoped>
.weekly {
  padding: 16px;
}

.tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.grid-wrap {
  display: grid;
  grid-template-columns: 56px repeat(7, minmax(0, 1fr));
  gap: 4px;
  overflow-x: auto;
}

.corner {
  height: 48px;
}

.time-cell {
  height: 42px;
  font-size: 11px;
  color: var(--text-secondary);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 6px;
}

.day-col {
  min-width: 0;
  border-radius: 10px;
  cursor: pointer;
}

.day-col.selected .day-head,
.day-col.today .day-head {
  background: var(--primary-soft);
}

.day-col.today strong {
  color: var(--primary);
}

.day-head {
  height: 48px;
  border-radius: 10px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.day-head strong {
  font-size: 16px;
  color: var(--text);
}

.day-body {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(180deg, #fff, #fafbfc);
}

.slot {
  height: 42px;
  border-bottom: 1px dashed #eef2f7;
}

.slot:last-child {
  border-bottom: none;
}

.block {
  position: absolute;
  border-left: 3px solid;
  border-radius: 6px;
  padding: 4px 6px;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.3;
  color: #1f2937;
  container-type: inline-size;
  cursor: pointer;
}

/* 悬浮置顶：任何层级的块都能完整看到 */
.block:hover {
  z-index: 100 !important;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.16);
}

/* 层叠后的窄块：隐藏时间/负责人行，只留标题（完整信息看悬浮卡） */
@container (max-width: 76px) {
  .block-meta {
    display: none;
  }

.stack-badge {
  position: absolute;
  top: 3px;
  right: 4px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #b45309;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.6;
  border: 1px solid rgba(245, 158, 11, 0.5);
}

.block-title {
    font-size: 10px;
  }
}

.block.conflict {
  color: #b45309;
  box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.45);
}

/* 已完成：整块灰度弱化 */
.block.done {
  color: #64748b;
  opacity: 0.88;
}

.block.done .block-title,
.block.done .block-meta {
  color: #64748b;
}

.block.conflict:hover {
  box-shadow:
    inset 0 0 0 1px rgba(245, 158, 11, 0.45),
    0 4px 14px rgba(15, 23, 42, 0.16);
}

.block-title {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block-meta {
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* FIX-6：逾期标记（派生显示，已完成/已取消/延期处理不出现） */
.overdue-tag {
  display: inline-block;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  background: rgba(220, 38, 38, 0.14);
  color: #b91c1c;
  vertical-align: 1px;
}

/* FIX-4：跨天延续标记 */
.cross-tag {
  display: inline-block;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  background: rgba(139, 92, 246, 0.18);
  color: #6d28d9;
  vertical-align: 1px;
}

.hover-card {
  position: fixed;
  z-index: 1000;
  width: 270px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.16);
  font-size: 13px;
  color: var(--text);
  pointer-events: none;
}

.hc-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.hc-head strong {
  font-size: 14px;
}

.hc-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
}

.hc-row > span:first-child {
  color: var(--text-secondary);
  font-size: 12px;
  flex-shrink: 0;
}

.hc-warn {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--warning-soft);
  color: #b45309;
  font-size: 12px;
}

.hc-desc {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #f8fafc;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.cp-note {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.click-panel {
  position: fixed;
  z-index: 1001;
  width: 304px;
  max-height: 440px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.18);
  font-size: 13px;
  color: var(--text);
}

.cp-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  color: #b45309;
}

.cp-head strong {
  font-size: 13px;
}

.cp-close {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 6px;
}

.cp-close:hover {
  background: #f3f4f6;
  color: var(--text);
}

.cp-list {
  margin: 0;
  padding: 6px;
  list-style: none;
  overflow-y: auto;
}

.cp-list li {
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
}

.cp-list li + li {
  margin-top: 4px;
}

.cp-list li:hover {
  background: #f1f5f9;
}

.cp-list li.current {
  background: var(--warning-soft);
  box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.4);
}

.cp-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.cp-main strong {
  font-size: 13px;
}

.cp-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.cp-tip {
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
}
</style>
