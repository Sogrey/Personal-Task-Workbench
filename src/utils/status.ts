import type { TaskStatus } from '@/types'

export function statusBadgeClass(status: TaskStatus) {
  switch (status) {
    case 'in_progress':
      return 'badge badge-success'
    case 'pending':
      return 'badge badge-info'
    case 'to_confirm':
      return 'badge badge-warning'
    case 'done':
      return 'badge badge-neutral'
    default:
      return 'badge badge-neutral'
  }
}

/** 状态专属色（周视图色块 / 甘特图条形统一使用）：
 *  待处理=蓝、进行中=绿、待确认=紫、已完成/已取消=灰度；
 *  时间重叠（冲突）固定橙色，优先级高于状态色。 */
export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#3b82f6',
  in_progress: '#10b981',
  to_confirm: '#8b5cf6',
  done: '#94a3b8',
  cancelled: '#94a3b8',
}

export const CONFLICT_COLOR = '#f59e0b'
