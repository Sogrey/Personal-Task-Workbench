<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { statusLabel, useWorkbenchStore } from '@/stores/workbench'
import type { Task } from '@/types'
import { CONFLICT_COLOR, STATUS_COLORS, statusBadgeClass } from '@/utils/status'
import { formatRangeSmart, toLocalDateKey } from '@/utils/date'

const store = useWorkbenchStore()
const router = useRouter()

/** FIX-7：3 天显示窗口——今天居中；今天为周一（本周首日）时今天是窗口第一天，
 *  今天为周日（本周末日）时今天是窗口第三天；浏览其它周时取该周中间 3 天 */
const WINDOW_DAYS = 3

const visibleDays = computed(() => {
  const days = store.weekDays
  const todayIdx = days.findIndex((d) => toLocalDateKey(d) === store.today)
  const startIdx = todayIdx < 0 ? 2 : Math.max(0, Math.min(4, todayIdx - 1))
  return days.slice(startIdx, startIdx + WINDOW_DAYS).map((d, i) => ({
    date: d,
    key: toLocalDateKey(d),
    label: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()],
    isWeekend: d.getDay() === 0 || d.getDay() === 6,
    isToday: toLocalDateKey(d) === store.today,
    idx: i,
  }))
})

/** 展示范围：与周视图同源切换周；FIX-7：仅显示窗口 3 天日期范围 */
const rangeLabel = computed(() => {
  const days = visibleDays.value
  const a = days[0]?.date
  const b = days[2]?.date
  if (!a || !b) return ''
  return `${a.getMonth() + 1}/${a.getDate()} – ${b.getMonth() + 1}/${b.getDate()}`
})

/** 窗口内任务行：与窗口有交集的活动任务（跨窗口延伸裁剪显示，窗口外不渲染）；
 *  FIX-8：行存起止绝对分钟（相对窗口首日 00:00），位置由分段线性映射展开工作时段 */
interface GanttRow {
  task: Task
  startMin: number
  endMin: number
  conflict: boolean
  done: boolean
}

const windowStart = computed(() => {
  const d = visibleDays.value[0]?.date ?? new Date()
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
})

const rows = computed<GanttRow[]>(() => {
  const start = windowStart.value
  const end = new Date(start)
  end.setDate(start.getDate() + WINDOW_DAYS)
  return store.tasks
    .filter((t) => t.status !== 'cancelled')
    .filter((t) => +new Date(t.startAt) < +end && +new Date(t.endAt) > +start)
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
    .map((task) => {
      const s = +new Date(task.startAt)
      const e = +new Date(task.endAt)
      const clampedStart = Math.max(s, +start)
      const clampedEnd = Math.min(e, +end)
      return {
        task,
        startMin: (clampedStart - +start) / 60000,
        endMin: (clampedEnd - +start) / 60000,
        conflict: store.conflictTaskIds.has(task.id),
        done: task.status === 'done',
      }
    })
})

/** ───── FIX-8：分段线性时间映射——工作时段展开（占列宽 75%）、非工作压缩（占 25%）───── */
const WORK_SHARE = 0.75

/** 分钟（0..1440）→ 当日列内百分比（0..100）；工作始(9:00)≈15%、工作末=15%+75%、24:00=100% */
function dayMinuteToPct(min: number) {
  const { start, end } = store.workHours
  const ws = start * 60
  const we = end * 60
  const workMin = we - ws
  const nonMin = 1440 - workMin
  const nonRate = nonMin > 0 ? ((1 - WORK_SHARE) / nonMin) * 100 : 0
  const workRate = workMin > 0 ? (WORK_SHARE / workMin) * 100 : 0
  const firstNon = ws * nonRate // 00:00 → 工作开始的压缩段
  if (min <= ws) return min * nonRate
  if (min <= we) return firstNon + (min - ws) * workRate
  return firstNon + workMin * workRate + (min - we) * nonRate
}

/** 窗口内绝对分钟（相对窗口首日 00:00，含多日）→ 窗口总宽百分比（映射单调，跨天/跨夜条连续） */
function windowPct(min: number) {
  const dayIdx = Math.min(WINDOW_DAYS - 1, Math.floor(min / 1440))
  const inDay = min - dayIdx * 1440
  return (dayIdx + dayMinuteToPct(inDay) / 100) * (100 / WINDOW_DAYS)
}

/** 每天的工作时段刻度：工作始 / 午间 / 工作末（HH:00 格式，FIX-8 按新映射拉开位置） */
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
  visibleDays.value.forEach((d, dayIdx) => {
    for (const h of hours) {
      ticks.push({
        key: `${d.key}-${h}`,
        label: `${String(h).padStart(2, '0')}:00`,
        pct: (dayIdx + dayMinuteToPct(h * 60) / 100) * (100 / WINDOW_DAYS),
      })
    }
  })
  return ticks
})

/** FIX-8：每日工作时段底带（浅色背景辅助读图，位置随新映射） */
const workBands = computed(() =>
  visibleDays.value.map((d, i) => {
    const left = (i + dayMinuteToPct(store.workHours.start * 60) / 100) * (100 / WINDOW_DAYS)
    const right = (i + dayMinuteToPct(store.workHours.end * 60) / 100) * (100 / WINDOW_DAYS)
    return { key: d.key, left: `${left}%`, width: `${right - left}%` }
  }),
)

/** 任务时间文本：同日仅时刻，跨天带 M/D（与周视图/时间线同口径） */
function timeText(row: GanttRow) {
  return formatRangeSmart(row.task.startAt, row.task.endAt)
}
/** FIX-7：条内文案 = 任务名 · 时间段（任务名在前，条窄时尾部时间截断，悬浮卡有全量） */
function barText(row: GanttRow) {
  return `${row.task.title} · ${timeText(row)}`
}
/** 任务条样式：FIX-8 分段线性映射定位（工作时段展开），短条给最小宽度兜底；
 *  --bar 状态色驱动配色 */
function barStyle(row: GanttRow) {
  const left = windowPct(row.startMin)
  const right = windowPct(row.endMin)
  const width = Math.max(right - left, 0.6)
  const color = row.conflict ? CONFLICT_COLOR : (STATUS_COLORS[row.task.status] ?? STATUS_COLORS.pending)
  return { left: `${left}%`, width: `${width}%`, '--bar': color }
}

/** 「现在」竖线：窗口内当前位置百分比（仅窗口含今天时显示，FIX-8 走新映射） */
const nowLineLeftPct = computed(() => {
  const now = new Date()
  const dayIdx = visibleDays.value.findIndex((d) => d.key === toLocalDateKey(now))
  if (dayIdx < 0) return null
  return (dayIdx + dayMinuteToPct(now.getHours() * 60 + now.getMinutes()) / 100) * (100 / WINDOW_DAYS)
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
  // 首屏滚到今天附近（窗口不含今天时定位中间列）
  const el = scrollBody.value
  const nowLeft = nowLineLeftPct.value ?? 50
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
  router.push({ path: '/tasks', query: { task: task.id } })
}

onBeforeUnmount(() => window.clearTimeout(hoverTimer))
</script>

<template>
  <section class="card gantt">
    <div class="card-title">
      <span>任务甘特图</span>
      <div class="tools">
        <span class="muted">{{ rangeLabel }} · 3 天窗口</span>
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
          v-for="d in visibleDays"
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
            <span class="t-title" :title="`查看「${row.task.title}」详情`" @click="openTask(row.task)">{{ row.task.title }}</span>
            <span class="t-sub">{{ timeText(row) }}</span>
          </div>
        </div>

        <!-- 右：时间网格与任务条（每个任务一行泳道） -->
        <div class="grid-col">
          <!-- 今天列高亮（星期对应列） -->
          <div
            v-for="d in visibleDays"
            :key="d.key"
            class="day-col-bg"
            :class="{ weekend: d.isWeekend, today: d.isToday }"
            :style="{ left: `${(100 / WINDOW_DAYS) * d.idx}%`, width: `${100 / WINDOW_DAYS}%` }"
          />

          <!-- FIX-8：每日工作时段底带（工作区间浅色，宽度=列宽 75%） -->
          <div v-for="b in workBands" :key="`wb-${b.key}`" class="work-band" :style="{ left: b.left, width: b.width }" />

          <!-- 交叉天分隔竖线 -->
          <div v-for="i in WINDOW_DAYS - 1" :key="`v-${i}`" class="day-sep" :style="{ left: `${(100 / WINDOW_DAYS) * i}%` }" />

          <!-- 任务条：每行一任务，条内按窗口内连续时间水平定位 -->
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

    <div v-else class="empty-hint">当前窗口暂无任务安排</div>

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
        <span>{{ formatRangeSmart(hoverCard.task.startAt, hoverCard.task.endAt) }}</span>
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

/* 顶部日期行：左角 + 3 天窗口（列宽充裕，短任务条内容不再截断） */
.gantt-head {
  display: grid;
  grid-template-columns: 180px repeat(3, minmax(160px, 1fr));
  position: sticky;
  top: 0;
  z-index: 5;
  background: #fff;
  border-bottom: 1px solid var(--border);
}

/* 小时刻度行：与日期列同构 */
.hour-head {
  display: grid;
  grid-template-columns: 180px minmax(480px, 1fr);
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
  /* 刻度位置基于整个窗口区域百分比，与任务条同一坐标系 */
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
  grid-template-columns: 180px minmax(480px, 1fr); /* 3 天 × 160px 最小宽度 */
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
  height: 48px;
  padding: 5px 10px;
  border-bottom: 1px dashed #eef2f7;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
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
  color: var(--info);
  text-decoration: underline;
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

/* 右侧时间区：每任务一行泳道，条形水平按窗口内时间定位 */
.grid-col {
  position: relative;
}

.bar-row {
  position: relative;
  height: 48px;
  border-bottom: 1px dashed #eef2f7;
}

.bar-row:last-child {
  border-bottom: none;
}

/* FIX-8：非工作时间整体弱化（工作带外更浅），突出工作时段 */
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

/* FIX-8：工作时段底带（占列宽 75%），左右细边界便于对齐刻度 */
.work-band {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(100, 116, 139, 0.07);
  box-shadow:
    inset 1px 0 0 rgba(100, 116, 139, 0.22),
    inset -1px 0 0 rgba(100, 116, 139, 0.22);
  z-index: 0;
  pointer-events: none;
}

.day-sep {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px dashed #e2e8f0;
  z-index: 0;
  pointer-events: none;
}

/* 任务条：行内水平定位（左=开始，宽=时长）；FIX-8 紧凑化 30px 高、11px 字号；
 *  按状态着色（待处理蓝/进行中绿/待确认紫/已完成灰） */
.bar {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 30px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--bar, #3b82f6) 14%, white);
  border: 1px solid color-mix(in srgb, var(--bar, #3b82f6) 50%, white);
  border-left: 3px solid var(--bar, #3b82f6);
  color: #1f2937;
  display: flex;
  align-items: center;
  padding: 0 8px;
  z-index: 2;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  font-size: 11px;
  min-width: 24px;
}

.bar.conflict {
  --bar: #f59e0b;
}

.bar.done {
  --bar: #94a3b8;
  background: #f1f5f9;
  opacity: 0.8;
  color: #64748b;
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
