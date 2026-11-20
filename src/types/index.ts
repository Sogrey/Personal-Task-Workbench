/** FIX-6：delayed = 延期处理（用户确认未按计划开始/需顺延的状态位） */
export type TaskStatus = 'pending' | 'in_progress' | 'to_confirm' | 'delayed' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ProjectStatus = 'active' | 'archived'
export type ReminderType = 'overdue' | 'due_soon' | 'conflict' | 'follow_up'
export type ReminderSeverity = 'info' | 'warning' | 'danger'

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Project {
  id: string
  name: string
  description?: string
  status: ProjectStatus
}

export interface Task {
  id: string
  title: string
  description?: string
  projectId?: string
  /** 父级任务 id（BK-16：支持多级拆分细化，任意任务可继续拆分子任务；子任务可解除关联成为独立任务） */
  parentId?: string
  owner: string
  contact?: string
  startAt: string
  endAt: string
  deadline?: string
  priority: TaskPriority
  status: TaskStatus
  tagIds: string[]
  createdAt: string
  updatedAt: string
  /** 实际完成时间（本地无时区 ISO）；done 时必有，重开自动清空；旧数据加载时从历史反推 */
  completedAt?: string
  /** 延期标识（闭环确认“未开始”时打标，不改动计划时间） */
  delayed?: boolean
  /** 延期说明 */
  delayNote?: string
  /** 已确认提前开始（A2 保留后不再重复追问） */
  startConfirmed?: boolean
}

export interface HistoryRecord {
  id: string
  time: string
  taskId: string
  taskTitle: string
  field: string
  oldValue: string
  newValue: string
  reason?: string
}

export interface ReminderItem {
  id: string
  type: ReminderType
  title: string
  description: string
  severity: ReminderSeverity
  taskIds: string[]
  progress?: number
}

export interface StatCard {
  key: string
  label: string
  value: number
  hint?: string
  tone: 'default' | 'success' | 'warning' | 'danger' | 'info'
}
