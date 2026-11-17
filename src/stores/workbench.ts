import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_TAGS } from '@/data/defaults'
import type { HistoryRecord, Project, ProjectStatus, ReminderItem, StatCard, Tag, Task, TaskStatus } from '@/types'
import { toLocalDateKey } from '@/utils/date'

const STORAGE_KEY = 'workbench-data-v1'

interface PersistedState {
  tasks: Task[]
  projects: Project[]
  tags: Tag[]
  history: HistoryRecord[]
}

export interface WorkbenchPrefs {
  displayName: string
  workStart: string
  workEnd: string
  dueSoonHours: number
}

const DEFAULT_PREFS: WorkbenchPrefs = {
  displayName: '我',
  workStart: '08:00',
  workEnd: '18:00',
  dueSoonHours: 24,
}

const PREFS_KEY = 'workbench-prefs-v1'

function loadPrefs(): WorkbenchPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<WorkbenchPrefs>
    return {
      displayName: typeof parsed.displayName === 'string' && parsed.displayName ? parsed.displayName : DEFAULT_PREFS.displayName,
      workStart: typeof parsed.workStart === 'string' && parsed.workStart ? parsed.workStart : DEFAULT_PREFS.workStart,
      workEnd: typeof parsed.workEnd === 'string' && parsed.workEnd ? parsed.workEnd : DEFAULT_PREFS.workEnd,
      dueSoonHours: typeof parsed.dueSoonHours === 'number' && parsed.dueSoonHours > 0 ? parsed.dueSoonHours : DEFAULT_PREFS.dueSoonHours,
    }
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
  const projects = ref<Project[]>(persisted?.projects ?? [])
  const tasks = ref<Task[]>(persisted?.tasks ?? [])
  const history = ref<HistoryRecord[]>(persisted?.history ?? [])

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
      if (t.status === 'done') return false
      const deadline = parseDate(t.deadline ?? t.endAt)
      return deadline < now && !isSameDay(deadline, now)
    })
  })

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

  function updateTaskStatus(taskId: string, status: TaskStatus) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task || task.status === status) return
    const old = task.status
    task.status = status
    task.updatedAt = new Date().toISOString()
    history.value.unshift({
      id: `h-${Date.now()}`,
      time: formatNow(),
      taskId: task.id,
      taskTitle: task.title,
      field: '状态变更',
      oldValue: statusLabel(old),
      newValue: statusLabel(status),
      reason: '工作台手动更新',
    })
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
    Object.assign(task, patch)
    task.updatedAt = new Date().toISOString()
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
    history.value.unshift({
      id: `h-${Date.now()}`,
      time: formatNow(),
      taskId: task.id,
      taskTitle: task.title,
      field: '新建任务',
      oldValue: '—',
      newValue: task.title,
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
    projectById,
    tagById,
    tagUsageCount,
    addTag,
    updateTag,
    deleteTag,
    setSelectedDate,
    shiftWeek,
    goTodayWeek,
    updateTaskStatus,
    updateTask,
    addTask,
    addProject,
    resetLocalData,
    tasksByProject,
    unfinishedByProject,
    projectProgress,
  }
})

function formatNow() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function statusLabel(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    pending: '待处理',
    in_progress: '进行中',
    to_confirm: '待确认',
    done: '已完成',
    cancelled: '已取消',
  }
  return map[status]
}

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
