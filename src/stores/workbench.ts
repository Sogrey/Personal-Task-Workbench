import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_TAGS } from '@/data/defaults'
import type { HistoryRecord, Project, ProjectStatus, ReminderItem, StatCard, Tag, Task, TaskStatus } from '@/types'
import { toLocalDateKey } from '@/utils/date'
import { statusLabel } from '@/utils/status'

const STORAGE_KEY = 'workbench-data-v1'

interface PersistedState {
  tasks: Task[]
  projects: Project[]
  tags: Tag[]
  history: HistoryRecord[]
}

export interface WorkbenchPrefs {
  displayName: string
  /** 任务默认负责人（新建表单预填、报告标题署名，FIX-2） */
  ownerName: string
  workStart: string
  workEnd: string
  dueSoonHours: number
}

const DEFAULT_PREFS: WorkbenchPrefs = {
  displayName: '我',
  ownerName: '苏朝恒',
  workStart: '08:00',
  workEnd: '18:00',
  dueSoonHours: 24,
}

const PREFS_KEY = 'workbench-prefs-v1'

const BACKUP_APP = 'personal-task-workbench'
const BACKUP_VERSION = 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** 偏好归一：字段缺失或类型不符时回落默认值（本地加载与导入备份共用） */
function normalizePrefs(raw: unknown): WorkbenchPrefs {
  const parsed = isRecord(raw) ? raw : {}
  return {
    displayName:
      typeof parsed.displayName === 'string' && parsed.displayName ? parsed.displayName : DEFAULT_PREFS.displayName,
    ownerName:
      typeof parsed.ownerName === 'string' && parsed.ownerName ? parsed.ownerName : DEFAULT_PREFS.ownerName,
    workStart:
      typeof parsed.workStart === 'string' && parsed.workStart ? parsed.workStart : DEFAULT_PREFS.workStart,
    workEnd: typeof parsed.workEnd === 'string' && parsed.workEnd ? parsed.workEnd : DEFAULT_PREFS.workEnd,
    dueSoonHours:
      typeof parsed.dueSoonHours === 'number' && parsed.dueSoonHours > 0
        ? parsed.dueSoonHours
        : DEFAULT_PREFS.dueSoonHours,
  }
}

function loadPrefs(): WorkbenchPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return normalizePrefs(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function loadPersisted(): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    if (
      !Array.isArray(parsed.tasks) ||
      !Array.isArray(parsed.projects) ||
      !Array.isArray(parsed.tags) ||
      !Array.isArray(parsed.history)
    ) {
      return null
    }
    return parsed
  } catch {
    // 数据损坏时回到默认空数据
    return null
  }
}

function savePersisted(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 存储不可用（隐私模式/配额满）时静默降级为会话内存
  }
}

function parseDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split('-').map(Number)
    const y = parts[0] ?? 0
    const m = parts[1] ?? 1
    const d = parts[2] ?? 1
    return new Date(y, m - 1, d)
  }
  // 无时区后缀时按本地时间解析，避免 ISO 被当成 UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    const [datePart = '', timePart = ''] = value.split('T')
    const dateParts = datePart.split('-').map(Number)
    const timeParts = timePart.split(':').map((x) => Number(x.slice(0, 2)))
    const y = dateParts[0] ?? 0
    const m = dateParts[1] ?? 1
    const d = dateParts[2] ?? 1
    const hh = timeParts[0] ?? 0
    const mm = timeParts[1] ?? 0
    const ss = timeParts[2] ?? 0
    return new Date(y, m - 1, d, hh, mm, ss)
  }
  return new Date(value)
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export const useWorkbenchStore = defineStore('workbench', () => {
  const realToday = toLocalDateKey(new Date())
  const today = ref(realToday)
  const selectedDate = ref(realToday)
  const weekAnchor = ref(realToday)

  const persisted = loadPersisted()
  const tags = ref<Tag[]>(persisted?.tags?.length ? persisted.tags : [...DEFAULT_TAGS])
  /** 旧数据迁移：done 任务无 completedAt 时从历史留痕反推（最后一次完成动作时间，再退 updatedAt）。
   *  迁移结果随持久化 watch 写回 localStorage，下次加载不再重复。 */
  const migratedHistory = persisted?.history ?? []
  for (const task of persisted?.tasks ?? []) {
    if (task.status === 'done' && !task.completedAt) {
      const rec = [...migratedHistory]
        .reverse()
        .find((h) => h.taskId === task.id && h.field === '状态变更' && h.newValue === '已完成')
      task.completedAt = rec ? rec.time.replace(' ', 'T') : task.updatedAt
    }
  }
  const projects = ref<Project[]>(persisted?.projects ?? [])
  const tasks = ref<Task[]>(persisted?.tasks ?? [])
  const history = ref<HistoryRecord[]>(migratedHistory)

  /** 偏好设置（设置页维护，持久化独立 key） */
  const prefs = ref<WorkbenchPrefs>(loadPrefs())

  function savePrefs(next: WorkbenchPrefs) {
    prefs.value = { ...next }
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next))
    } catch {
      // 存储不可用时仅会话内生效
    }
  }

  /** 工作时段起止小时数（甘特/周视图时间轴范围） */
  const workHours = computed(() => {
    const s = Number(prefs.value.workStart.slice(0, 2)) || 0
    const e = Number(prefs.value.workEnd.slice(0, 2))
    return { start: s, end: e > s ? e : 24 }
  })

  watch(
    [tasks, projects, tags, history],
    () => {
      savePersisted({
        tasks: tasks.value,
        projects: projects.value,
        tags: tags.value,
        history: history.value,
      })
    },
    { deep: true },
  )

  const todayDate = computed(() => parseDate(today.value))

  const activeTasks = computed(() => tasks.value.filter((t) => t.status !== 'cancelled'))

  const conflictPairs = computed(() => {
    const pairs: { owner: string; tasks: [Task, Task] }[] = []
    const list = activeTasks.value.filter((t) => t.status !== 'done')
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!
        const b = list[j]!
        if (a.owner !== b.owner) continue
        if (
          overlaps(parseDate(a.startAt), parseDate(a.endAt), parseDate(b.startAt), parseDate(b.endAt))
        ) {
          pairs.push({ owner: a.owner, tasks: [a, b] })
        }
      }
    }
    return pairs
  })

  const conflictTaskIds = computed(() => {
    const ids = new Set<string>()
    for (const pair of conflictPairs.value) {
      ids.add(pair.tasks[0].id)
      ids.add(pair.tasks[1].id)
    }
    return ids
  })

  const conflictGroups = computed(() => conflictPairs.value)

  const overdueTasks = computed(() => {
    const now = todayDate.value
    return activeTasks.value.filter((t) => {
      // 逾期口径排除已确认延期（FIX-6：status=delayed 或旧数据仅 delayed 打标）
      if (t.status === 'done' || t.status === 'delayed' || t.delayed) return false
      const deadline = parseDate(t.deadline ?? t.endAt)
      return deadline < now && !isSameDay(deadline, now)
    })
  })

  /** FIX-6：逾期任务 id 集（与 overdueTasks 同口径，供徽章/角标复用） */
  const overdueTaskIds = computed(() => new Set(overdueTasks.value.map((t) => t.id)))

  const todayTasks = computed(() => {
    const d = parseDate(selectedDate.value)
    return activeTasks.value
      .filter((t) => isSameDay(parseDate(t.startAt), d) || (t.deadline && isSameDay(parseDate(t.deadline), d)))
      .sort((a, b) => +parseDate(a.startAt) - +parseDate(b.startAt))
  })

  const inProgressTasks = computed(() => activeTasks.value.filter((t) => t.status === 'in_progress'))

  const todayTodoCount = computed(() => {
    const d = todayDate.value
    return activeTasks.value.filter((t) => {
      if (t.status === 'done') return false
      return isSameDay(parseDate(t.startAt), d) || (t.deadline && isSameDay(parseDate(t.deadline), d))
    }).length
  })

  const stats = computed<StatCard[]>(() => [
    {
      key: 'today',
      label: '今日待办',
      value: todayTodoCount.value,
      tone: 'success',
    },
    {
      key: 'progress',
      label: '进行中任务',
      value: inProgressTasks.value.length,
      tone: 'info',
    },
    {
      key: 'overdue',
      label: '逾期待办',
      value: overdueTasks.value.length,
      tone: 'warning',
    },
    {
      key: 'conflict',
      label: '时间冲突',
      value: conflictPairs.value.length,
      tone: 'warning',
    },
  ])

  const weekDays = computed(() => {
    const start = startOfWeek(parseDate(weekAnchor.value))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  })

  const weekTasks = computed(() => {
    const start = weekDays.value[0] ?? startOfWeek(parseDate(weekAnchor.value))
    const end = new Date(weekDays.value[6] ?? start)
    end.setHours(23, 59, 59, 999)
    return activeTasks.value.filter((t) => {
      const s = parseDate(t.startAt)
      return s >= start && s <= end
    })
  })

  const tagStats = computed(() =>
    tags.value.map((tag) => ({
      ...tag,
      count: activeTasks.value.filter((t) => t.tagIds.includes(tag.id) && t.status !== 'done').length,
    })),
  )

  const reminders = computed<ReminderItem[]>(() => {
    const dueSoon = activeTasks.value.filter((t) => {
      if (t.status === 'done') return false
      const deadline = parseDate(t.deadline ?? t.endAt)
      const diff = deadline.getTime() - todayDate.value.getTime()
      return diff >= 0 && diff <= prefs.value.dueSoonHours * 60 * 60 * 1000
    })

    const followUps = activeTasks.value.filter(
      (t) => t.status !== 'done' && (t.tagIds.includes('tag-follow') || t.status === 'to_confirm'),
    )

    return [
      {
        id: 'r-overdue',
        type: 'overdue',
        title: '临期 / 逾期预警',
        description: `${overdueTasks.value.length} 项已逾期，需优先处理`,
        severity: 'danger',
        taskIds: overdueTasks.value.map((t) => t.id),
        progress: Math.min(100, overdueTasks.value.length * 35),
      },
      {
        id: 'r-follow',
        type: 'follow_up',
        title: '后续跟进事项',
        description: `${followUps.length} 项等待反馈或确认`,
        severity: 'info',
        taskIds: followUps.map((t) => t.id),
        progress: Math.min(100, followUps.length * 15),
      },
      {
        id: 'r-due',
        type: 'due_soon',
        title: '今日临期交付',
        description: `${dueSoon.length} 项将在 ${prefs.value.dueSoonHours} 小时内到期`,
        severity: 'warning',
        taskIds: dueSoon.map((t) => t.id),
        progress: Math.min(100, dueSoon.length * 20),
      },
      {
        id: 'r-conflict',
        type: 'conflict',
        title: '时间冲突',
        description: `${conflictPairs.value.length} 组日程时间重叠（任务可并行，留意安排）`,
        severity: 'warning',
        taskIds: [...conflictTaskIds.value],
        progress: Math.min(100, conflictPairs.value.length * 30),
      },
    ]
  })

  const reminderBadgeCount = computed(
    () => overdueTasks.value.length + conflictPairs.value.length,
  )

  function projectById(id?: string) {
    return projects.value.find((p) => p.id === id)
  }

  function tagById(id: string) {
    return tags.value.find((t) => t.id === id)
  }

  /** 标签被多少个任务引用（含已完成） */
  function tagUsageCount(id: string) {
    return tasks.value.filter((t) => t.tagIds.includes(id)).length
  }

  function addTag(name: string, color: string) {
    const trimmed = name.trim()
    if (!trimmed) return null
    if (tags.value.some((t) => t.name === trimmed)) return null
    const tag: Tag = { id: `tag-${Date.now()}`, name: trimmed, color }
    tags.value.push(tag)
    return tag
  }

  function updateTag(id: string, patch: { name?: string; color?: string }) {
    const tag = tags.value.find((t) => t.id === id)
    if (!tag) return false
    const name = patch.name?.trim()
    if (name && tags.value.some((t) => t.name === name && t.id !== id)) return false
    if (name) tag.name = name
    if (patch.color) tag.color = patch.color
    return true
  }

  /** 删除标签：被任务引用时禁止（返回原因） */
  function deleteTag(id: string): { ok: boolean; reason?: string } {
    const used = tagUsageCount(id)
    if (used > 0) {
      return { ok: false, reason: `${used} 个任务正在使用该标签，请先在任务中移除` }
    }
    const idx = tags.value.findIndex((t) => t.id === id)
    if (idx < 0) return { ok: false }
    tags.value.splice(idx, 1)
    return { ok: true }
  }

  /** BK-15：删除任务。有子任务时禁止（与 deleteProject 同口径）；删除动作写历史留痕（保留标题快照） */
  function deleteTask(taskId: string): { ok: boolean; reason?: string } {
    const idx = tasks.value.findIndex((t) => t.id === taskId)
    const removed = idx >= 0 ? tasks.value[idx] : undefined
    if (!removed) return { ok: false, reason: '任务不存在或已被删除' }
    const children = tasks.value.filter((t) => t.parentId === taskId).length
    if (children > 0) {
      return { ok: false, reason: `${children} 个子任务关联该任务，请先删除子任务或在编辑中解除关联` }
    }
    tasks.value.splice(idx, 1)
    history.value.unshift({
      id: `h-${Date.now()}`,
      time: formatNow(),
      taskId: removed.id,
      taskTitle: removed.title,
      field: '删除任务',
      oldValue: removed.title,
      newValue: '已删除',
      reason: '工作台删除任务',
    })
    return { ok: true }
  }

  /** BK-15：某任务的直接子任务（含已取消，父子关系不随状态消失） */
  function childTasks(taskId: string) {
    return tasks.value.filter((t) => t.parentId === taskId)
  }

  /** BK-16：全部后代 id 集（多级拆分；含环防御，脏数据成环时不死循环） */
  function descendantIds(taskId: string) {
    const out = new Set<string>()
    const walk = (pid: string) => {
      for (const t of tasks.value) {
        if (t.parentId === pid && !out.has(t.id)) {
          out.add(t.id)
          walk(t.id)
        }
      }
    }
    walk(taskId)
    return out
  }

  /** BK-15：父任务的子任务完成进度 { done, total }（直接子任务）；无子任务返回 null */
  function childProgress(taskId: string) {
    const children = tasks.value.filter((t) => t.parentId === taskId)
    if (!children.length) return null
    return { done: children.filter((t) => t.status === 'done').length, total: children.length }
  }

  /** BK-6：删除项目。仍有任务引用时禁止（与 deleteTag 同口径），避免任务的项目关联悬空 */
  function deleteProject(projectId: string): { ok: boolean; reason?: string } {
    const used = tasks.value.filter((t) => t.projectId === projectId).length
    if (used > 0) {
      return { ok: false, reason: `${used} 个任务关联该项目，请先移除任务的项目关联或删除任务` }
    }
    const idx = projects.value.findIndex((p) => p.id === projectId)
    if (idx < 0) return { ok: false, reason: '项目不存在或已被删除' }
    projects.value.splice(idx, 1)
    return { ok: true }
  }

  function setSelectedDate(isoDate: string) {
    selectedDate.value = isoDate.slice(0, 10)
  }

  function shiftWeek(delta: number) {
    const d = parseDate(weekAnchor.value)
    d.setDate(d.getDate() + delta * 7)
    weekAnchor.value = toLocalDateKey(d)
  }

  function goTodayWeek() {
    weekAnchor.value = today.value
    selectedDate.value = today.value
  }

  /** BK-5：reason 供批量操作等场景标注留痕来源（默认工作台手动更新） */
  function updateTaskStatus(taskId: string, status: TaskStatus, reason = '工作台手动更新') {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task || task.status === status) return
    const old = task.status
    task.status = status
    task.updatedAt = new Date().toISOString()
    // FIX-6 状态清理口径：完成写实际完成时间并清延期标识（与 completeTask 一致）；
    // 离开 done 清完成时间（归因由 closedLoop 重新确认）；
    // 转「延期处理」同步打延期标识，转其他状态视为恢复正常、清延期标识（留痕在 history 可审计）
    if (status === 'done') {
      task.completedAt = toLocalIsoNow()
      task.delayed = false
      task.delayNote = undefined
    } else {
      task.completedAt = undefined
      if (status === 'delayed') {
        task.delayed = true
      } else {
        task.delayed = false
        task.delayNote = undefined
      }
    }
    history.value.unshift({
      id: `h-${Date.now()}`,
      time: formatNow(),
      taskId: task.id,
      taskTitle: task.title,
      field: '状态变更',
      oldValue: statusLabel(old),
      newValue: statusLabel(status),
      reason,
    })
  }

  /** 本地无时区 ISO（不能用 toISOString，会转 UTC） */
  function toLocalIsoNow() {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  /** ───────── 报告闭环动作（CL 用例，写入 history 便于审计） ───────── */

  /** 确认完成：completedAt 支持补录指定日期（默认此刻）；已完成幂等（重复确认只更新时间） */
  function completeTask(taskId: string, completedAt?: string) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task) return
    const at = (completedAt ?? '').trim()
    // 接受 YYYY-MM-DD 或完整 ISO；仅日期时拼当前时分秒
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(at) ? `${at}T${toLocalIsoNow().slice(11)}` : at || toLocalIsoNow()
    const old = task.status
    const oldAt = task.completedAt
    task.status = 'done'
    task.completedAt = normalized
    task.delayed = false
    task.delayNote = undefined
    task.updatedAt = new Date().toISOString()
    history.value.unshift({
      id: `h-${Date.now()}`,
      time: formatNow(),
      taskId: task.id,
      taskTitle: task.title,
      field: old === 'done' ? '完成时间补录' : '状态变更',
      oldValue: old === 'done' ? (oldAt ?? '—') : statusLabel(old),
      newValue: old === 'done' ? normalized : statusLabel(task.status),
      reason: '报告闭环确认',
    })
  }

  /** 确认已开始（B1）：状态改进行中 + 可选进展说明 */
  function markStarted(taskId: string, note?: string) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task) return
    const old = task.status
    task.status = 'in_progress'
    task.delayed = false
    task.delayNote = undefined
    task.updatedAt = new Date().toISOString()
    history.value.unshift({
      id: `h-${Date.now()}`,
      time: formatNow(),
      taskId: task.id,
      taskTitle: task.title,
      field: '闭环确认',
      oldValue: statusLabel(old),
      newValue: '进行中',
      reason: '报告闭环确认 · 已开始',
    })
    if (note?.trim()) addProgressNote(taskId, note)
  }

  /** 确认延期（C1/B1 未开始分支）：置「延期处理」状态并打标，不改动计划时间（FIX-6 闭环联动） */
  function markDelayed(taskId: string, note?: string) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task || task.delayed) return
    const old = task.status
    task.status = 'delayed'
    task.delayed = true
    task.delayNote = note?.trim() || undefined
    task.updatedAt = new Date().toISOString()
    history.value.unshift({
      id: `h-${Date.now()}`,
      time: formatNow(),
      taskId: task.id,
      taskTitle: task.title,
      field: '状态变更',
      oldValue: statusLabel(old),
      newValue: statusLabel('delayed'),
      reason: '报告闭环确认 · 延期处理',
    })
    if (note?.trim()) addProgressNote(taskId, note)
  }

  /** 采集进展说明（B2 可选 / C2 必要）：只写留痕不动状态 */
  function addProgressNote(taskId: string, note: string) {
    const text = note.trim()
    if (!text) return
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task) return
    task.updatedAt = new Date().toISOString()
    history.value.unshift({
      id: `h-${Date.now()}`,
      time: formatNow(),
      taskId: task.id,
      taskTitle: task.title,
      field: '进展说明',
      oldValue: '—',
      newValue: text,
      reason: '报告闭环采集',
    })
  }

  /** 确认提前开工（A2 保留）或改回待处理（A2 修正）；保留后不再重复追问 */
  function confirmEarlyStart(taskId: string, keep: boolean) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task) return
    const old = task.status
    if (keep) {
      task.startConfirmed = true
      history.value.unshift({
        id: `h-${Date.now()}`,
        time: formatNow(),
        taskId: task.id,
        taskTitle: task.title,
        field: '闭环确认',
        oldValue: '未到计划开始',
        newValue: '确认提前开始',
        reason: '报告闭环确认',
      })
    } else {
      task.status = 'pending'
      task.delayed = false
      task.delayNote = undefined
      task.updatedAt = new Date().toISOString()
      history.value.unshift({
        id: `h-${Date.now()}`,
        time: formatNow(),
        taskId: task.id,
        taskTitle: task.title,
        field: '状态变更',
        oldValue: statusLabel(old),
        newValue: statusLabel('pending'),
        reason: '报告闭环确认 · 修正误标',
      })
    }
  }

  /** 任务最近一条进展说明（周报进行中展示） */
  function latestProgressNote(taskId: string) {
    const rec = history.value.find(
      (h) => h.taskId === taskId && h.field === '进展说明' && h.newValue !== '—',
    )
    return rec?.newValue
  }

  const TASK_FIELD_LABELS: Partial<Record<keyof Task, string>> = {
    title: '任务名称',
    description: '备注',
    projectId: '所属项目',
    owner: '负责人',
    contact: '对接人',
    startAt: '开始时间',
    endAt: '结束时间',
    deadline: '截止时间',
    priority: '优先级',
    status: '状态',
    tagIds: '标签',
    parentId: '父任务',
  }

  /** 编辑任务：逐字段比对，变化字段写入历史（含标签增删），时间/项目/标签显示为可读文本 */
  function updateTask(taskId: string, patch: Partial<Task>, reason?: string) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task) return
    const records: HistoryRecord[] = []
    let changed = false

    for (const [key, value] of Object.entries(patch)) {
      const k = key as keyof Task
      if (k === 'id' || k === 'createdAt' || k === 'updatedAt') continue
      const oldVal = task[k]
      // 比较前归一：undefined 与空串视为相同（可选字段清空场景），数组排序后比较
      const normalize = (v: unknown) =>
        v === undefined ? '' : Array.isArray(v) ? [...v].sort().join(',') : v
      if (normalize(oldVal) === normalize(value)) continue
      changed = true
      const labelMap: Partial<Record<keyof Task, (v: never) => string>> = {
        priority: (v) => priorityLabel(v as Task['priority']),
        status: (v) => statusLabel(v as TaskStatus),
        startAt: (v) => (v ? formatDateTimeReadable(v as string) : '—'),
        endAt: (v) => (v ? formatDateTimeReadable(v as string) : '—'),
        deadline: (v) => (v ? formatDateTimeReadable(v as string) : '—'),
        projectId: (v) => projectById(v as string)?.name ?? '未关联',
        parentId: (v) =>
          v ? (tasks.value.find((t) => t.id === (v as string))?.title ?? (v as string)) : '无',
        tagIds: (v) =>
          (v as string[]).length
            ? (v as string[]).map((id) => tagById(id)?.name ?? id).join('、')
            : '无',
      }
      const oldText = labelMap[k] ? labelMap[k]!(oldVal as never) : String(normalize(oldVal)) || '—'
      const newText = labelMap[k] ? labelMap[k]!(value as never) : String(normalize(value)) || '—'
      records.push({
        id: `h-${Date.now()}-${records.length}`,
        time: formatNow(),
        taskId: task.id,
        taskTitle: (patch.title as string) ?? task.title,
        field: TASK_FIELD_LABELS[k] ?? k,
        oldValue: oldText,
        newValue: newText,
        reason: reason ?? '工作台编辑任务',
      })
    }

    if (!changed) return
    const oldStatus = task.status
    Object.assign(task, patch)
    task.updatedAt = new Date().toISOString()
    // FIX-6：编辑表单变更状态时同步延期标识（与 updateTaskStatus 同口径，避免 status 与 delayed 脱节）
    if (patch.status && patch.status !== oldStatus) {
      if (patch.status === 'delayed') task.delayed = true
      else {
        task.delayed = false
        task.delayNote = undefined
      }
    }
    history.value.unshift(...records)
  }

  function addTask(payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    const task: Task = {
      ...payload,
      id: `task-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    }
    tasks.value.unshift(task)
    const parent = payload.parentId ? tasks.value.find((t) => t.id === payload.parentId) : undefined
    history.value.unshift({
      id: `h-${Date.now()}`,
      time: formatNow(),
      taskId: task.id,
      taskTitle: task.title,
      field: '新建任务',
      oldValue: '—',
      newValue: parent ? `${task.title}（子任务，父任务：${parent.title}）` : task.title,
      reason: '工作台录入',
    })
    return task
  }

  function addProject(payload: { name: string; description?: string; status?: ProjectStatus }) {
    const project: Project = {
      id: `proj-${Date.now()}`,
      name: payload.name,
      description: payload.description?.trim() || undefined,
      status: payload.status ?? 'active',
    }
    projects.value.unshift(project)
    return project
  }

  /** BK-8：导出完整本地数据（任务/项目/标签/历史/偏好）为 JSON 文本 */
  function exportData(): string {
    return JSON.stringify(
      {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: toLocalIsoNow(),
        data: {
          tasks: tasks.value,
          projects: projects.value,
          tags: tags.value,
          history: history.value,
          prefs: prefs.value,
        },
      },
      null,
      2,
    )
  }

  /** BK-8：导入备份（覆盖当前数据）。校验顶层结构与任务必要字段，其余字段由既有默认值兜底 */
  function importData(raw: string): { ok: boolean; reason?: string } {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, reason: '文件不是有效的 JSON' }
    }
    if (!isRecord(parsed)) return { ok: false, reason: '备份文件格式不正确' }
    // 兼容 { app, version, data } 包装格式与直接导出的数据对象
    const data = isRecord(parsed.data) ? parsed.data : parsed
    const nextTasks = data.tasks
    const nextProjects = data.projects
    const nextTags = data.tags
    const nextHistory = data.history
    if (
      !Array.isArray(nextTasks) ||
      !Array.isArray(nextProjects) ||
      !Array.isArray(nextTags) ||
      !Array.isArray(nextHistory)
    ) {
      return { ok: false, reason: '备份文件缺少 tasks/projects/tags/history 数据' }
    }
    for (const item of nextTasks) {
      if (!isRecord(item) || typeof item.id !== 'string' || typeof item.title !== 'string') {
        return { ok: false, reason: '备份文件包含无效任务记录' }
      }
    }
    tasks.value = nextTasks as Task[]
    projects.value = nextProjects as Project[]
    tags.value = nextTags.length ? (nextTags as Tag[]) : [...DEFAULT_TAGS]
    history.value = nextHistory as HistoryRecord[]
    if (data.prefs) savePrefs(normalizePrefs(data.prefs))
    selectedDate.value = today.value
    weekAnchor.value = today.value
    return { ok: true }
  }

  function resetLocalData() {
    tasks.value = []
    projects.value = []
    history.value = []
    tags.value = [...DEFAULT_TAGS]
    selectedDate.value = today.value
    weekAnchor.value = today.value
  }

  function tasksByProject(projectId: string) {
    return activeTasks.value.filter((t) => t.projectId === projectId)
  }

  function unfinishedByProject(projectId: string) {
    return tasksByProject(projectId).filter((t) => t.status !== 'done').length
  }

  /** 项目进度按任务完成率派生（已完成 / 非取消总数），无任务时为 0 */
  function projectProgress(projectId: string) {
    const list = tasksByProject(projectId)
    if (list.length === 0) return 0
    const done = list.filter((t) => t.status === 'done').length
    return Math.round((done / list.length) * 100)
  }

  return {
    today,
    selectedDate,
    weekAnchor,
    prefs,
    savePrefs,
    workHours,
    tags,
    projects,
    tasks,
    history,
    stats,
    todayTasks,
    weekDays,
    weekTasks,
    tagStats,
    reminders,
    reminderBadgeCount,
    overdueTasks,
    inProgressTasks,
    conflictTaskIds,
    conflictPairs,
    conflictGroups,
    overdueTaskIds,
    projectById,
    tagById,
    tagUsageCount,
    addTag,
    updateTag,
    deleteTag,
    deleteTask,
    deleteProject,
    childTasks,
    descendantIds,
    childProgress,
    setSelectedDate,
    shiftWeek,
    goTodayWeek,
    updateTaskStatus,
    updateTask,
    addTask,
    addProject,
    exportData,
    importData,
    resetLocalData,
    tasksByProject,
    unfinishedByProject,
    projectProgress,
    completeTask,
    markStarted,
    markDelayed,
    addProgressNote,
    confirmEarlyStart,
    latestProgressNote,
  }
})

function formatNow() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export { statusLabel }

export function priorityLabel(priority: Task['priority']) {
  const map = { low: '低', medium: '中', high: '高', urgent: '紧急' } as const
  return map[priority]
}

export function formatTimeRange(startAt: string, endAt: string) {
  const fmt = (v: string) => {
    const d = new Date(v)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${fmt(startAt)}–${fmt(endAt)}`
}

export function formatShortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 无时区 ISO（YYYY-MM-DDTHH:mm:ss）→ "M/D HH:mm" 可读文本，用于历史记录 */
function formatDateTimeReadable(v: string): string {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
