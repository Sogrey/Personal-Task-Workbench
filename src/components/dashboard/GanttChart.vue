<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatTimeRange, statusLabel, useWorkbenchStore } from '@/stores/workbench'
import type { Task } from '@/types'
import { statusBadgeClass } from '@/utils/status'
import { toLocalDateKey } from '@/utils/date'

const store = useWorkbenchStore()
const router = useRouter()

/** 展示范围：选中周（与周视图同鈰），按周切换 */
const weekLabel = computed(() => {
  const days = store.weekDays
  const a = days[0]
  const b = days[6]
  if (!a || !b) return ''
  return `${a.getFullYear()}年${a.getMonth() + 1}月${a.getDate()}日 – ${b.getMonth() + 1}月${b.getDate()}日`
})

const dayCells = computed(() =>
  store.weekDays.map((d, i) => ({
    date: d,
    key: toLocalDateKey(d),
    label: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()],
    isWeekend: d.getDay() === 0 || d.getDay() === 6,
    isToday: toLocalDateKey(d) === store.today,
    idx: i,
  })),
)

/** 本周任务行：按开始时间排序；跨天任务裁剪到本周边界内绘制。
 *  位置采用「周内总分钟数」连续定位（甘特语义），不把条形对齐到整天格子。 */
interface GanttRow {
  task: Task
  /** 相对周一 00:00 的总分钟偏移（连续，不对齐天格） */
  offsetMin: number
  durationMin: number
  conflict: boolean
  done: boolean
}

const weekStart = computed(() => {
  const d = store.weekDays[0] ?? new Date()
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
})

const rows = computed<GanttRow[]>(() => {
  const list = [...store.weekTasks].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
  const start = weekStart.value
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return list.map((task) => {
    const s = +new Date(task.startAt)
    const e = +new Date(task.endAt)
    const clampedStart = Math.max(s, +start)
    const clampedEnd = Math.min(e, +end)
    return {
      task,
      offsetMin: (clampedStart - +start) / 60000,
      durationMin: Math.max(20, (clampedEnd - clampedStart) / 60000),
      conflict: store.conflictTaskIds.has(task.id),
      done: task.status === 'done',
    }
  })
})

/** 每天的小时刻度：工作开始 / 午间 / 工作结束（短标签，避免 7 天全量时刻过密） */
interface DayTick {
  key: string
  label: string
  pct: number
}

const dayTicks = computed<DayTick[]>(() => {
  const { start, end } = store.workHours
  const mid = Math.round((start + end) / 2)
  const hours = [start, mid, end]
  const ticks: DayTick[] = []
  dayCells.value.forEach((d, dayIdx) => {
    const dayPct = 100 / 7
    for (const h of hours) {
      ticks.push({
        key: `${d.key}-${h}`,
        label: `${h}`,
        pct: (dayIdx + h / 24) * dayPct,
      })
    }
  })
  return ticks
})

/** 任务条内文案：跨天补日期，条够宽才显示 */
function barText(row: GanttRow) {
  const s = new Date(row.task.startAt)
  const e = new Date(row.task.endAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  const sTxt = `${day(s)} ${pad(s.getHours())}:${pad(s.getMinutes())}`
  const eTxt = `${day(e)} ${pad(e.getHours())}:${pad(e.getMinutes())}`
  return `${sTxt} – ${eTxt}`
}
/** 跨天条样式：周内连续分钟 → 百分比横向定位 */
function barStyle(row: GanttRow) {
  const weekMin = 7 * 24 * 60
  const left = (row.offsetMin / weekMin) * 100
  const width = (row.durationMin / weekMin) * 100
  return { left: `${left}%`, width: `${width}%` }
}

/** 「现在」竖线：周内当前位置百分比（仅本周内显示） */
const nowLineLeftPct = computed(() => {
  const now = new Date()
  const dayIdx = dayCells.value.findIndex((d) => d.key === toLocalDateKey(now))
  if (dayIdx < 0) return null
  const dayPct = 100 / 7
  const dayOffsetPct = ((now.getHours() * 60 + now.getMinutes()) / 1440) * dayPct
  return dayIdx * dayPct + dayOffsetPct
})

const scrollBody = ref<HTMLElement | null>(null)

function scrollNowIntoView() {
  const el = scrollBody.value
  if (!el) return
  const nowLeft = nowLineLeftPct.value
  if (nowLeft !== null) {
    const grid = el.querySelector('.grid-col') as HTMLElement | null
    const gridW = grid?.clientWidth ?? el.clientWidth
    el.scrollLeft = Math.max(0, (nowLeft / 100) * gridW - el.clientWidth * 0.4)
  }
}

onMounted(() => {
  // 首屏滚到今天附近
  const el = scrollBody.value
  const nowLeft = nowLineLeftPct.value ?? (5 / 7) * 100
  if (el) {
    requestAnimationFrame(() => {
      const grid = el.querySelector('.grid-col') as HTMLElement | null
      const gridW = grid?.clientWidth ?? el.clientWidth
      el.scrollLeft = Math.max(0, (nowLeft / 100) * gridW - el.clientWidth * 0.4)
    })
  }
})

/** 悬浮信息卡（复用周视图同构结构） */
interface HoverCard {
  task: Task
  x: number
  y: number
}

const hoverCard = ref<HoverCard | null>(null)
let hoverTimer: number | undefined

function onBarEnter(e: MouseEvent, row: GanttRow) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  window.clearTimeout(hoverTimer)
  hoverTimer = window.setTimeout(() => {
    hoverCard.value = {
      task: row.task,
      x: Math.max(8, Math.min(rect.right + 10, window.innerWidth - 286)),
      y: Math.max(8, Math.min(rect.top, innerHeight - 240)),
    }
  }, 250)
}

function onBarLeave() {
  window.clearTimeout(hoverTimer)
  hoverCard.value = null
}

function openTask(task: Task) {
  router.push({ path: '/tasks', query: { q: task.title } })
}

onBeforeUnmount(() => window.clearTimeout(hoverTimer))
</script>

<template>
  <section class="card gantt">
    <div class="card-title">
      <span>本周任务甘特图</span>
      <div class="tools">
        <span class="muted">{{ weekLabel }}</span>
        <button class="btn btn-ghost" type="button" @click="store.shiftWeek(-1)">‹</button>
        <button class="btn" type="button" @click="store.goTodayWeek()">今天</button>
        <button class="btn btn-ghost" type="button" @click="store.shiftWeek(1)">›</button>
        <button v-if="nowLineLeftPct !== null" class="btn" type="button" @click="scrollNowIntoView">回到此刻</button>
      </div>
    </div>

    <div v-if="rows.length" class="gantt-wrap" ref="scrollBody">
      <!-- 顶部日期行固定 -->
      <div class="gantt-head">
        <div class="corner">任务 / 时间</div>
        <div
          v-for="d in dayCells"
          :key="d.key"
          class="day-head"
          :class="{ weekend: d.isWeekend, today: d.isToday }"
        >
          <span>{{ d.label }}</span>
          <strong>{{ d.date.getMonth() + 1 }}/{{ d.date.getDate() }}</strong>
        </div>
      </div>
      <!-- 小时刻度行：每天 3 个刻度（始/中/末） -->
      <div class="hour-head">
        <div class="corner-hour">工作时段 {{ store.prefs.workStart }}–{{ store.prefs.workEnd }}</div>
        <div class="hour-scale">
          <span
            v-for="t in dayTicks"
            :key="t.key"
            :style="{ left: `${t.pct}%` }"
          >{{ t.label }}</span>
        </div>
      </div>

      <div class="gantt-body">
        <!-- 左：任务名列 -->
        <div class="task-col">
          <div
            v-for="row in rows"
            :key="row.task.id"
            class="task-cell"
            :class="{ done: row.done, conflict: row.conflict }"
          >
            <span class="t-title" @click="openTask(row.task)">{{ row.task.title }}</span>
            <span class="t-sub">{{ barText(row) }}</span>
          </div>
        </div>

        <!-- 右：时间网格与任务条（每个任务一行泳道） -->
        <div class="grid-col">
          <!-- 今天列高亮（星期对应列） -->
          <div
            v-for="d in dayCells"
            :key="d.key"
            class="day-col-bg"
            :class="{ weekend: d.isWeekend, today: d.isToday }"
            :style="{ left: `${(100 / 7) * d.idx}%`, width: `${100 / 7}%` }"
          />

          <!-- 交叉天分隔竖线 -->
          <div v-for="i in 6" :key="`v-${i}`" class="day-sep" :style="{ left: `${(100 / 7) * i}%` }" />

          <!-- 任务条：每行一任务，条内按周内连续时间水平定位 -->
          <div v-for="row in rows" :key="row.task.id" class="bar-row">
            <div
              class="bar"
              :class="{ conflict: row.conflict, done: row.done }"
              :style="barStyle(row)"
              @mouseenter="onBarEnter($event, row)"
              @mouseleave="onBarLeave"
            >
              <span class="bar-label">{{ barText(row) }}</span>
            </div>
          </div>

          <!-- 现在时刻竖线（横向时间轴位置） -->
          <div
            v-if="nowLineLeftPct !== null"
            class="now-line"
            :style="{ left: `${nowLineLeftPct}%` }"
          />
        </div>
      </div>
    </div>

    <div v-else class="empty-hint">本周暂无任务安排</div>

    <div
      v-if="hoverCard"
      class="hover-card"
      :style="{ left: `${hoverCard.x}px`, top: `${hoverCard.y}px` }"
    >
      <div class="hc-head">
        <strong>{{ hoverCard.task.title }}</strong>
        <span :class="statusBadgeClass(hoverCard.task.status)">
          {{ statusLabel(hoverCard.task.status) }}
        </span>
      </div>
      <div class="hc-row">
        <span>时间</span>
        <span>{{ formatTimeRange(hoverCard.task.startAt, hoverCard.task.endAt) }}</span>
      </div>
      <div class="hc-row">
        <span>负责人</span>
        <span>
          {{ hoverCard.task.owner }}
          <template v-if="hoverCard.task.contact"> · 对接：{{ hoverCard.task.contact }}</template>
        </span>
      </div>
      <div class="hc-row">
        <span>项目</span>
        <span>{{ store.projectById(hoverCard.task.projectId)?.name ?? '未关联' }}</span>
      </div>
      <div v-if="hoverCard.task.description" class="hc-desc">{{ hoverCard.task.description }}</div>
      <div v-if="store.conflictTaskIds.has(hoverCard.task.id)" class="hc-warn">
        时间重叠 · 任务可并行，留意安排
      </div>
    </div>
  </section>
</template>

<style scoped>
.gantt {
  padding: 16px;
  overflow: hidden;
}

.tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.gantt-wrap {
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  max-height: 640px;
}

/* 顶部日期行：左角 + 7 天 */
.gantt-head {
  display: grid;
  grid-template-columns: 180px repeat(7, minmax(120px, 1fr));
  position: sticky;
  top: 0;
  z-index: 5;
  background: #fff;
  border-bottom: 1px solid var(--border);
}

/* 小时刻度行：与日期列同构 */
.hour-head {
  display: grid;
  grid-template-columns: 180px minmax(840px, 1fr);
  position: sticky;
  top: 48px;
  z-index: 5;
  background: #fff;
  border-bottom: 1px solid var(--border);
}

.corner-hour {
  font-size: 10px;
  color: var(--text-secondary);
  padding: 4px 10px;
  border-right: 1px solid var(--border);
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.hour-scale {
  position: relative;
  height: 22px;
  /* 刻度位置基于整个周区域百分比，与任务条同一坐标系 */
}

.hour-scale span {
  position: absolute;
  top: 4px;
  font-size: 9px;
  color: #94a3b8;
  transform: translateX(-50%);
  padding: 0 2px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1;
}

.corner {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  align-items: center;
}

.day-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0;
  border-left: 1px dashed var(--border);
}

.day-head span {
  font-size: 11px;
  color: var(--text-secondary);
}

.day-head strong {
  font-size: 13px;
}

.day-head.weekend strong {
  color: #d97706;
}

.day-head.today {
  background: var(--primary-soft);
  border-radius: 8px 8px 0 0;
}

.day-head.today strong {
  color: var(--primary);
}

.gantt-body {
  display: grid;
  grid-template-columns: 180px minmax(840px, 1fr); /* 7 天 × 120px 最小宽度，保证小时刻度可读 */
  position: relative;
}

.task-col {
  border-right: 1px solid var(--border);
  background: #fbfcfe;
  position: sticky;
  left: 0;
  z-index: 4;
}

/* 小时刻度仅落在每天的工作时段区，其他时间留给任务条本身 */

.task-cell {
  height: 88px;
  padding: 10px 12px;
  border-bottom: 1px dashed #eef2f7;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.task-cell.done {
  opacity: 0.55;
}

.t-title {
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.t-title:hover {
  color: var(--primary);
}

.t-sub {
  font-size: 11px;
  color: var(--text-secondary);
}

.task-cell.conflict .t-title::after {
  content: '· 重叠';
  font-size: 10px;
  color: #b45309;
  font-weight: 400;
}

/* 右侧时间区：每任务一行泳道，条形水平按周内时间定位 */
.grid-col {
  position: relative;
}

.bar-row {
  position: relative;
  height: 88px;
  border-bottom: 1px dashed #eef2f7;
}

.bar-row:last-child {
  border-bottom: none;
}

.day-col-bg {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 0;
  pointer-events: none;
}

.day-col-bg.weekend {
  background: rgba(248, 250, 252, 0.6);
}

.day-col-bg.today {
  background: rgba(67, 160, 71, 0.06);
  border-left: 1px dashed rgba(67, 160, 71, 0.35);
  border-right: 1px dashed rgba(67, 160, 71, 0.35);
}

.day-sep {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px dashed #e2e8f0;
  z-index: 0;
  pointer-events: none;
}

/* 任务条：行内水平定位（左=开始，宽=时长） */
.bar {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 56px;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.14);
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-left: 3px solid #3b82f6;
  color: #1f2937;
  display: flex;
  align-items: center;
  padding: 0 10px;
  z-index: 2;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  font-size: 12px;
  min-width: 36px;
}

.bar.conflict {
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(245, 158, 11, 0.5);
  border-left-color: #f59e0b;
}

.bar.done {
  background: #f1f5f9;
  border-color: #cbd5e1;
  border-left-color: #94a3b8;
  opacity: 0.8;
}

.bar:hover {
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.16);
  z-index: 6;
}

.bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.now-line {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 2px solid var(--danger);
  z-index: 5;
  pointer-events: none;
}

.now-line::before {
  content: '现在';
  position: absolute;
  top: -1px;
  left: 4px;
  font-size: 10px;
  color: #fff;
  background: var(--danger);
  border-radius: 999px;
  padding: 1px 7px;
  white-space: nowrap;
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

.hc-desc {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #f8fafc;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.hc-warn {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--warning-soft);
  color: #b45309;
  font-size: 12px;
}
</style>
