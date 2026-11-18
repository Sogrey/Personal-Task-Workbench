import type { HistoryRecord, Project, Tag, Task } from '@/types'
import { toLocalDateKey } from '@/utils/date'

/** 报告数据层：纯函数，从（tasks/projects/tags/history）提炼日报/周报/月报数据。
 *  完成口径 = completedAt 优先（含闭环补录），无则历史留痕「状态变更 → 已完成」反推；
 *  不含已取消任务。时间口径 = 无时区本地 ISO；投入时长为「计划口径」（startAt→endAt），非实际耗时。 */

export interface ReportInput {
  tasks: Task[]
  projects: Project[]
  tags: Tag[]
  history: HistoryRecord[]
  /** 今天（YYYY-MM-DD）；缺省时取历史最新记录日期，避免未来周期误判逾期 */
  today?: string
}

export interface ProjectStat {
  id: string
  name: string
  total: number
  done: number
  unfinished: number
  progress: number
}

export interface DailyReport {
  date: string
  weekday: string
  completed: Task[]
  inProgress: Task[]
  created: Task[]
  tomorrow: Task[]
  overdue: Task[]
  adjustments: HistoryRecord[]
}

export interface WeeklyReport {
  weekStart: string
  weekEnd: string
  label: string
  completed: Task[]
  inProgress: { task: Task; note?: string }[]
  created: Task[]
  projectStats: ProjectStat[]
  timeByProject: { name: string; hours: number }[]
  riskOverdue: Task[]
  riskDelayed: Task[]
  riskHighPriority: Task[]
  nextWeek: Task[]
}

export interface MonthlyReport {
  month: string
  label: string
  monthlyRange: string
  weeklyTrend: { label: string; completed: number }[]
  completedCount: number
  createdCount: number
  overdueCount: number
  /** 完成时效：提前（早于计划开始）/ 按时（窗口内）/ 超时（晚于计划结束） */
  timeliness: { early: number; ontime: number; late: number }
  projectStats: ProjectStat[]
  tagDist: { name: string; count: number }[]
  completed: Task[]
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function dayKey(s: string) {
  return s.slice(0, 10)
}

/** 无时区本地 ISO → 周几标签 */
export function weekdayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return WEEKDAY_NAMES[new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getDay()] ?? ''
}

export function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() + n)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export function startOfWeekIso(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
  const diff = dt.getDay() === 0 ? -6 : 1 - dt.getDay()
  dt.setDate(dt.getDate() + diff)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function lastDayOfMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y ?? 0, m ?? 0, 0).getDate()
}

export function monthEndDay(month: string) {
  return `${month}-${String(lastDayOfMonth(month)).padStart(2, '0')}`
}

export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return `${y ?? 0}年${m ?? 0}月`
}

/** 活动（非取消）任务 */
function activeOf(tasks: Task[]) {
  return tasks.filter((t) => t.status !== 'cancelled')
}

/** 报告基准日：显式 today，否则取最新留痕日期，再退回到任一任务日期 */
function todayOf(input: ReportInput) {
  if (input.today) return input.today
  const fromHistory = input.history[0]?.time.slice(0, 10)
  if (fromHistory) return fromHistory
  return input.tasks[0]?.startAt.slice(0, 10) ?? '9999-12-31'
}

/** 截止时间早于 before 且未完成的任务（逾期口径；before 应传 min(周期末, 今天)）。
 *  FIX-6：已确认延期（status=delayed 或旧数据打标）不计入逾期，归入「已确认延期」分组，避免双重计数 */
function overdueBefore(tasks: Task[], before: string) {
  return activeOf(tasks).filter((t) => {
    if (t.status === 'done' || t.status === 'delayed' || t.delayed) return false
    const deadline = dayKey(t.deadline ?? t.endAt)
    return deadline < before
  })
}

/** 报告时点基准：未来周期以今天为界（未到截止的不算逾期），过去周期用周期末 */
function overdueDeadline(periodEnd: string, today: string) {
  return periodEnd < today ? periodEnd : today
}

/** 任务实际完成时间的归因口径：completedAt 优先（含补录），否则历史留痕反推（旧数据）。
 *  返回 YYYY-MM-DD（仅日期，供区间归因与展示） */
export function completedDayOf(task: Task, history: HistoryRecord[]): string | null {
  if (task.status !== 'done') return null
  if (task.completedAt) return dayKey(task.completedAt)
  const rec = [...history]
    .reverse()
    .find((h) => h.taskId === task.id && h.field === '状态变更' && h.newValue === '已完成')
  return rec ? dayKey(rec.time) : null
}

/** 指定日期区间内完成归因的任务（completedAt 优先，留痕兜底） */
function completedInRange(input: ReportInput, from: string, to: string) {
  return activeOf(input.tasks)
    .map((t) => ({ t, day: completedDayOf(t, input.history) }))
    .filter(({ day }) => day && day >= from && day <= to)
    .map(({ t }) => t)
    .sort(
      (a, b) =>
        (completedDayOf(a, input.history) ?? '').localeCompare(completedDayOf(b, input.history) ?? ''),
    )
}

/** 指定日期区间内新建的任务 */
function createdInRange(input: ReportInput, from: string, to: string) {
  const ids = new Set<string>()
  for (const rec of input.history) {
    if (rec.field === '新建任务' && dayKey(rec.time) >= from && dayKey(rec.time) <= to) {
      ids.add(rec.taskId)
    }
  }
  return input.tasks.filter((t) => ids.has(t.id))
}

/** 各项目任务统计（不含已取消） */
function projectStats(input: ReportInput): ProjectStat[] {
  return input.projects.map((p) => {
    const list = activeOf(input.tasks).filter((t) => t.projectId === p.id)
    const done = list.filter((t) => t.status === 'done').length
    return {
      id: p.id,
      name: p.name,
      total: list.length,
      done,
      unfinished: list.length - done,
      progress: list.length ? Math.round((done / list.length) * 100) : 0,
    }
  })
}

/** 任务计划投入时长（小时） */
function plannedHours(task: Task) {
  const ms = +new Date(task.endAt) - +new Date(task.startAt)
  return ms > 0 ? ms / 3600000 : 0
}

function tagNamesOf(input: ReportInput, task: Task) {
  const names = (task.tagIds ?? [])
    .map((id) => input.tags.find((t) => t.id === id)?.name)
    .filter((n): n is string => !!n)
  return names
}

/** 任务最近一条进展说明（闭环采集写入 history） */
export function latestProgressNote(taskId: string, history: HistoryRecord[]) {
  return history.find((h) => h.taskId === taskId && h.field === '进展说明')?.newValue
}

/* ---------- 闭环检测（报告生成前的状态一致性检查，CL 用例矩阵） ---------- */

export interface ClosedLoopItem {
  task: Task
  /** must：需确认闭环（C1/C2 窗口已过未闭环、B1 窗口内未开始、A2 未到开始却标记进行中）；
   *  optional：可选进展采集（B2 窗口内进行中） */
  group: 'must' | 'optional'
  kind: 'overdue_open' | 'not_started' | 'early_start' | 'progress_probe'
  question: string
  hint: string
}

/** 检查规则：
 *  - C 组：now ≥ endAt 且未完成 → 必答（已标延期的不重复追问）
 *  - B 组：startAt ≤ now < endAt；pending/to_confirm → 必答是否开始；in_progress → 可选采集进展
 *  - A2：now < startAt 却非 pending → 必答是否提前开工
 *  - 跳过：done / cancelled / A1（未开始且待处理，正常态） */
export function closedLoopChecks(input: ReportInput, now = new Date()): ClosedLoopItem[] {
  const items: ClosedLoopItem[] = []
  const nowMs = now.getTime()
  for (const task of input.tasks) {
    // FIX-6：延期处理已确认闭环，不再追问
    if (task.status === 'cancelled' || task.status === 'done' || task.status === 'delayed') continue
    const startMs = +new Date(task.startAt)
    const endMs = +new Date(task.endAt)
    const window = `${task.startAt.slice(5, 16).replace('T', ' ')} – ${task.endAt.slice(5, 16).replace('T', ' ')}`
    if (nowMs >= endMs) {
      if (!task.delayed) {
        items.push({
          task,
          group: 'must',
          kind: 'overdue_open',
          question:
            task.status === 'pending' || task.status === 'to_confirm'
              ? '计划时间已过但任务还未开始，实际情况是？'
              : '计划时间已过但任务仍未完成，实际情况是？',
          hint: `计划窗口 ${window}`,
        })
      }
    } else if (nowMs >= startMs) {
      if (task.status === 'pending' || task.status === 'to_confirm') {
        if (!task.delayed) {
          items.push({
            task,
            group: 'must',
            kind: 'not_started',
            question: '已到计划开始时间但任务尚未标记开始，实际情况是？',
            hint: `计划窗口 ${window}`,
          })
        }
      } else {
        // B2：窗口内进行中，可选采集；今天已有进展说明的不重复提示
        const latest = input.history.find((h) => h.taskId === task.id && h.field === '进展说明')
        if (!latest || dayKey(latest.time) !== toLocalDateKey(now)) {
          items.push({
            task,
            group: 'optional',
            kind: 'progress_probe',
            question: '任务进行中，是否已完成或需要记录进展？',
            hint: `计划窗口 ${window}`,
          })
        }
      }
    } else if (task.status !== 'pending' && !task.startConfirmed) {
      items.push({
        task,
        group: 'must',
        kind: 'early_start',
        question: '未到计划开始时间但任务已标记开始，是否确实提前开工？',
        hint: `计划窗口 ${window}`,
      })
    }
  }
  const rank = { overdue_open: 0, not_started: 1, early_start: 2, progress_probe: 3 } as const
  return items.sort((a, b) => rank[a.kind] - rank[b.kind])
}

/* ---------- 日报 ---------- */

export function buildDailyReport(input: ReportInput, date: string): DailyReport {
  const next = addDays(date, 1)
  return {
    date,
    weekday: weekdayLabel(date),
    completed: completedInRange(input, date, date),
    inProgress: activeOf(input.tasks)
      .filter((t) => t.status === 'in_progress' && dayKey(t.startAt) <= date)
      .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt)),
    created: createdInRange(input, date, date),
    // 明日排期保留已完成项（展示层标「提前完成」），信息不丢失
    tomorrow: activeOf(input.tasks).filter(
      (t) => dayKey(t.startAt) === next || (t.deadline && dayKey(t.deadline) === next),
    ),
    overdue: overdueBefore(input.tasks, overdueDeadline(date, todayOf(input))),
    adjustments: input.history.filter((rec) => dayKey(rec.time) === date),
  }
}

/* ---------- 周报 ---------- */

export function buildWeeklyReport(input: ReportInput, weekStart: string): WeeklyReport {
  const weekEnd = addDays(weekStart, 6)
  const weeksTasks = activeOf(input.tasks).filter(
    (t) => dayKey(t.startAt) >= weekStart && dayKey(t.startAt) <= weekEnd,
  )
  // 计划投入按项目聚合（时长归开始日，简化口径）
  const hoursMap = new Map<string, number>()
  for (const t of weeksTasks) {
    const name = input.projects.find((p) => p.id === t.projectId)?.name ?? '未关联项目'
    hoursMap.set(name, (hoursMap.get(name) ?? 0) + plannedHours(t))
  }
  const timeByProject = [...hoursMap.entries()]
    .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours)

  return {
    weekStart,
    weekEnd,
    label: `${weekStart.slice(5).replace('-', '/')} – ${weekEnd.slice(5).replace('-', '/')}`,
    completed: completedInRange(input, weekStart, weekEnd),
    inProgress: activeOf(input.tasks)
      .filter((t) => t.status === 'in_progress' && dayKey(t.startAt) <= weekEnd)
      .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
      .map((task) => ({ task, note: latestProgressNote(task.id, input.history) })),
    created: createdInRange(input, weekStart, weekEnd),
    projectStats: projectStats(input).filter((p) => p.total > 0),
    timeByProject,
    riskOverdue: overdueBefore(input.tasks, overdueDeadline(weekEnd, todayOf(input))),
    riskDelayed: activeOf(input.tasks).filter(
      (t) => (t.delayed || t.status === 'delayed') && t.status !== 'done',
    ),
    riskHighPriority: activeOf(input.tasks).filter(
      (t) =>
        t.status !== 'done' &&
        (t.priority === 'high' || t.priority === 'urgent') &&
        dayKey(t.startAt) <= weekEnd,
    ),
    nextWeek: activeOf(input.tasks).filter(
      (t) => dayKey(t.startAt) > weekEnd && dayKey(t.startAt) <= addDays(weekEnd, 7),
    ),
  }
}

/* ---------- 月报 ---------- */

export function buildMonthlyReport(input: ReportInput, month: string): MonthlyReport {
  const from = `${month}-01`
  const to = monthEndDay(month)
  const completed = completedInRange(input, from, to)
  const created = createdInRange(input, from, to)

  // 月内按 7 天分段：1–7 / 8–14 / 15–21 / 22–28 / 29–月末，完成按归因日分桶
  const buckets: { label: string; from: string; to: string; completed: number }[] = []
  for (let i = 0; i < 5; i++) {
    const s = i * 7 + 1
    if (s > lastDayOfMonth(month)) break
    const e = Math.min(s + 6, lastDayOfMonth(month))
    buckets.push({
      label: `${s}–${e}日`,
      from: `${month}-${String(s).padStart(2, '0')}`,
      to: `${month}-${String(e).padStart(2, '0')}`,
      completed: 0,
    })
  }
  const timeliness = { early: 0, ontime: 0, late: 0 }
  for (const t of completed) {
    const day = completedDayOf(t, input.history)
    if (!day) continue
    const b = buckets.find((x) => day >= x.from && day <= x.to)
    if (b) b.completed++
    if (day < dayKey(t.startAt)) timeliness.early++
    else if (day > dayKey(t.endAt)) timeliness.late++
    else timeliness.ontime++
  }

  // 月内完成任务的标签分布
  const tagCounter = new Map<string, number>()
  for (const t of completed) {
    const names = tagNamesOf(input, t)
    if (!names.length) {
      tagCounter.set('未分类', (tagCounter.get('未分类') ?? 0) + 1)
    } else {
      for (const n of names) tagCounter.set(n, (tagCounter.get(n) ?? 0) + 1)
    }
  }
  const tagDist = [...tagCounter.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return {
    month,
    label: monthLabel(month),
    monthlyRange: `${from.slice(5).replace('-', '/')} – ${to.slice(5).replace('-', '/')}`,
    weeklyTrend: buckets.map((b) => ({ label: b.label, completed: b.completed })),
    completedCount: completed.length,
    createdCount: created.length,
    overdueCount: overdueBefore(input.tasks, overdueDeadline(to, todayOf(input))).length,
    timeliness,
    projectStats: projectStats(input).filter((p) => p.total > 0),
    tagDist,
    completed,
  }
}

/* ---------- Markdown 序列化 ---------- */

/** 逾期天数文本（相对基准日） */
export function overdueDaysText(task: Task, today: string) {
  const deadline = dayKey(task.deadline ?? task.endAt)
  const diff = Math.round((+new Date(today) - +new Date(deadline)) / 86400000)
  return diff > 0 ? `（逾期 ${diff} 天）` : ''
}

/** FIX-1：条目仅保留项目，不再携带时间段与负责人（负责人在标题署名一次） */
function taskLine(t: Task, projectName: (id?: string) => string) {
  const proj = t.projectId ? projectName(t.projectId) : ''
  return `- ${t.title}${proj ? `（${proj}）` : ''}`
}

export function dailyToMarkdown(
  r: DailyReport,
  ownerName: string,
  projectName: (id?: string) => string,
  tagName: (id: string) => string | undefined,
  history: HistoryRecord[] = [],
) {
  const L: string[] = []
  L.push(`# 工作日报 · ${r.date}（${r.weekday}）· ${ownerName}`, '')
  L.push(`## 今日完成（${r.completed.length} 项）`)
  if (r.completed.length) r.completed.forEach((t) => L.push(taskLine(t, projectName)))
  else L.push('- 无')
  L.push('')
  L.push(`## 进行中（${r.inProgress.length} 项）`)
  if (r.inProgress.length) {
    r.inProgress.forEach((t) => {
      const note = latestProgressNote(t.id, history)
      L.push(taskLine(t, projectName) + (note ? `｜进展：${note}` : ''))
    })
  } else L.push('- 无')
  L.push('')
  L.push(`## 今日新增（${r.created.length} 项）`)
  if (r.created.length) r.created.forEach((t) => L.push(`- ${t.title}${t.projectId ? `（${projectName(t.projectId)}）` : ''}`))
  else L.push('- 无')
  L.push('')
  L.push(`## 明日排期（${r.tomorrow.length} 项）`)
  if (r.tomorrow.length) {
    r.tomorrow.forEach((t) => {
      if (t.status === 'done') {
        const day = completedDayOf(t, history) ?? '—'
        L.push(`- ${t.title} · ✓ 已提前完成（实际 ${day}）`)
      } else {
        L.push(`- ${t.title} · 截止 ${dayKey(t.deadline ?? t.endAt)}`)
      }
    })
  } else L.push('- 无')
  L.push('')
  if (r.overdue.length) {
    L.push(`## ⚠ 逾期未完成（${r.overdue.length} 项）`)
    r.overdue.forEach((t) =>
      L.push(`- ${t.title} · 截止 ${dayKey(t.deadline ?? t.endAt)}${overdueDaysText(t, r.date)}`),
    )
    L.push('')
  }
  L.push(`## 调整记录（${r.adjustments.length} 条）`)
  if (r.adjustments.length) {
    r.adjustments.forEach((rec) =>
      L.push(`- ${rec.time.slice(11)} ${rec.taskTitle}：${rec.field} ${rec.oldValue} → ${rec.newValue}`),
    )
  } else L.push('- 无')
  L.push('')
  const tagHint = [...new Set(r.completed.flatMap((t) => t.tagIds).map(tagName).filter(Boolean))]
  if (tagHint.length) L.push(`> 标签：${tagHint.join('、')}｜数据来自任务工作台本地记录`, '')
  return L.join('\n')
}

export function weeklyToMarkdown(
  r: WeeklyReport,
  ownerName: string,
  projectName: (id?: string) => string,
  today: string,
  history: HistoryRecord[] = [],
) {
  const L: string[] = []
  L.push(`# 工作周报 · ${r.label} · ${ownerName}`, '')
  L.push('## 本周概览')
  L.push(`- 完成任务：${r.completed.length} 项`)
  L.push(`- 进行中：${r.inProgress.length} 项`)
  L.push(`- 新建任务：${r.created.length} 项`)
  L.push(`- 逾期未完成：${r.riskOverdue.length} 项`)
  L.push(`- 已确认延期：${r.riskDelayed.length} 项`)
  L.push('')
  L.push('## 完成明细')
  if (r.completed.length) r.completed.forEach((t) => L.push(taskLine(t, projectName)))
  else L.push('- 本周无完成任务')
  L.push('')
  if (r.projectStats.length) {
    L.push('## 项目进展')
    L.push('| 项目 | 关联任务 | 已完成 | 未完成 | 完成率 |', '|------|------|------|------|------|')
    r.projectStats.forEach((p) =>
      L.push(`| ${p.name} | ${p.total} | ${p.done} | ${p.unfinished} | ${p.progress}% |`),
    )
    L.push('')
  }
  if (r.timeByProject.length) {
    L.push('## 时间投入（计划口径，按项目）')
    const total = r.timeByProject.reduce((s, x) => s + x.hours, 0)
    r.timeByProject.forEach((x) =>
      L.push(`- ${x.name}：${x.hours}h${total > 0 ? `（${Math.round((x.hours / total) * 100)}%）` : ''}`),
    )
    L.push(`- 合计：${Math.round(total * 10) / 10}h`, '')
  }
  if (r.riskOverdue.length || r.riskHighPriority.length || r.riskDelayed.length) {
    L.push('## 未完成与风险')
    if (r.riskOverdue.length) {
      L.push(`**逾期（${r.riskOverdue.length} 项）**`)
      r.riskOverdue.forEach((t) =>
        L.push(`- ${t.title} · 截止 ${dayKey(t.deadline ?? t.endAt)}${overdueDaysText(t, today)}`),
      )
    }
    if (r.riskDelayed.length) {
      L.push(`**已确认延期（${r.riskDelayed.length} 项）**`)
      r.riskDelayed.forEach((t) =>
        L.push(`- ${t.title}${t.delayNote ? ` · ${t.delayNote}` : ''}`),
      )
    }
    if (r.riskHighPriority.length) {
      L.push(`**高优先级未完成（${r.riskHighPriority.length} 项）**`)
      r.riskHighPriority.forEach((t) => L.push(`- ${t.title}（${t.priority === 'urgent' ? '紧急' : '高'}）`))
    }
    L.push('')
  }
  if (r.inProgress.length) {
    L.push('## 进行中与进展')
    r.inProgress.forEach(({ task, note }) => {
      L.push(`- ${task.title}${note ? `｜进展：${note}` : '｜暂无进展说明'}`)
    })
    L.push('')
  }
  L.push(`## 下周排期（${r.nextWeek.length} 项）`)
  if (r.nextWeek.length) {
    r.nextWeek.forEach((t) => {
      if (t.status === 'done') {
        const day = completedDayOf(t, history) ?? '—'
        L.push(`- ${t.title} · ✓ 已提前完成（实际 ${day}）`)
      } else {
        L.push(`- ${t.title} · ${dayKey(t.startAt)} 开始`)
      }
    })
  } else L.push('- 暂无排期')
  L.push('')
  return L.join('\n')
}

export function monthlyToMarkdown(r: MonthlyReport, ownerName: string, projectName: (id?: string) => string) {
  const L: string[] = []
  L.push(`# 工作月报 · ${r.label}（${r.monthlyRange}）· ${ownerName}`, '')
  L.push('## 月度概览')
  L.push(`- 完成任务：${r.completedCount} 项（提前 ${r.timeliness.early} · 按时 ${r.timeliness.ontime} · 超时 ${r.timeliness.late}）`)
  L.push(`- 新建任务：${r.createdCount} 项`)
  L.push(`- 截至月末逾期：${r.overdueCount} 项`)
  L.push('')
  L.push('## 周完成趋势')
  L.push('| 时段 | 完成数 |', '|------|------|')
  r.weeklyTrend.forEach((w) => L.push(`| ${w.label} | ${w.completed} |`))
  L.push('')
  if (r.projectStats.length) {
    L.push('## 项目进展')
    L.push('| 项目 | 关联任务 | 已完成 | 未完成 | 完成率 |', '|------|------|------|------|------|')
    r.projectStats.forEach((p) => L.push(`| ${p.name} | ${p.total} | ${p.done} | ${p.unfinished} | ${p.progress}% |`))
    L.push('')
  }
  if (r.tagDist.length) {
    L.push('## 完成任务标签分布')
    r.tagDist.forEach((t) => L.push(`- ${t.name}：${t.count} 项`))
    L.push('')
  }
  if (r.completed.length) {
    L.push('## 完成明细')
    r.completed.forEach((t) => L.push(`- ${t.title}${t.projectId ? `（${projectName(t.projectId)}）` : ''}`))
    L.push('')
  }
  return L.join('\n')
}