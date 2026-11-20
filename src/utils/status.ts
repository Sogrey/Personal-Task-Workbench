import type { TaskStatus } from '@/types'

/** BK-7：状态选项唯一来源（筛选/批量/表单/行内/抽屉统一引用，避免各处手写遗漏）。
 *  BK-20 顺序按状态流转：待确认/待处理/延期处理 → 进行中 → 已完成；已取消为终态。 */
export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'to_confirm', label: '待确认' },
  { value: 'pending', label: '待处理' },
  { value: 'delayed', label: '延期处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
]

export function statusLabel(status: TaskStatus) {
  return TASK_STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status
}

export function statusBadgeClass(status: TaskStatus) {
  switch (status) {
    case 'in_progress':
      return 'badge badge-success'
    case 'pending':
      return 'badge badge-info'
    case 'to_confirm':
      // BK-1：待确认徽章由琥珀改紫，与状态色板（#8b5cf6）统一，与时间冲突橙脱钩
      return 'badge badge-purple'
    case 'delayed':
      return 'badge badge-purple'
    case 'done':
      return 'badge badge-neutral'
    default:
      return 'badge badge-neutral'
  }
}

/** 状态专属色（周视图色块 / 甘特图条形统一使用）：
 *  待处理=蓝、进行中=绿、待确认/延期处理=紫、已完成/已取消=灰度；
 *  时间重叠（冲突）固定橙色，优先级高于状态色。 */
export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#3b82f6',
  in_progress: '#10b981',
  to_confirm: '#8b5cf6',
  delayed: '#8b5cf6',
  done: '#94a3b8',
  cancelled: '#94a3b8',
}

export const CONFLICT_COLOR = '#f59e0b'