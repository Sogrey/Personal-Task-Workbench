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
