import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { historyRecords as seedHistory, projects as seedProjects, tags as seedTags, tasks as seedTasks, WORKBENCH_TODAY } from '@/data/mock'
import type { HistoryRecord, Project, ReminderItem, StatCard, Tag, Task, TaskStatus } from '@/types'
import { toLocalDateKey } from '@/utils/date'

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
  const today = ref(WORKBENCH_TODAY)
  const selectedDate = ref(WORKBENCH_TODAY)
  const weekAnchor = ref(WORKBENCH_TODAY)

  const tags = ref<Tag[]>([...seedTags])
  const projects = ref<Project[]>([...seedProjects])
  const tasks = ref<Task[]>([...seedTasks])
  const history = ref<HistoryRecord[]>([...seedHistory])

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
      hint: '较昨日 +2',
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
      tone: 'danger',
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
      return diff >= 0 && diff <= 24 * 60 * 60 * 1000
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
        progress: Math.min(100, overdueTasks.value.length * 35 + 10),
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
        description: `${dueSoon.length} 项将在 24 小时内到期`,
        severity: 'warning',
        taskIds: dueSoon.map((t) => t.id),
        progress: Math.min(100, dueSoon.length * 20),
      },
      {
        id: 'r-conflict',
        type: 'conflict',
        title: '时间冲突',
        description: `${conflictPairs.value.length} 组日程存在重叠`,
        severity: 'danger',
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

  function tasksByProject(projectId: string) {
    return activeTasks.value.filter((t) => t.projectId === projectId)
  }

  function unfinishedByProject(projectId: string) {
    return tasksByProject(projectId).filter((t) => t.status !== 'done').length
  }

  return {
    today,
    selectedDate,
    weekAnchor,
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
    setSelectedDate,
    shiftWeek,
    goTodayWeek,
    updateTaskStatus,
    addTask,
    tasksByProject,
    unfinishedByProject,
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
