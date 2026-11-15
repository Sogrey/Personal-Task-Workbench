export type TaskStatus = 'pending' | 'in_progress' | 'to_confirm' | 'done' | 'cancelled'
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
  progress: number
}

export interface Task {
  id: string
  title: string
  description?: string
  projectId?: string
  owner: string
  startAt: string
  endAt: string
  deadline?: string
  priority: TaskPriority
  status: TaskStatus
  tagIds: string[]
  createdAt: string
  updatedAt: string
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
