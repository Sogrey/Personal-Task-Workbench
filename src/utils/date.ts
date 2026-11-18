import type { Task } from '@/types'

export function toLocalDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** FIX-5：智能时间区间——同日仅显示时刻（HH:mm–HH:mm，日期看列头/上下文）；
 *  跨日带日期（M/D HH:mm – M/D HH:mm），脱离上下文也能区分是哪天 */
export function formatRangeSmart(startAt: string, endAt: string) {
  const s = new Date(startAt)
  const e = new Date(endAt)
  const hm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const sameDay =
    s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate()
  if (sameDay) return `${hm(s)}–${hm(e)}`
  const mdhm = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} ${hm(d)}`
  return `${mdhm(s)} – ${mdhm(e)}`
}

/** FIX-6：逾期天数（相对基准日，今天）。已完成/已取消/延期处理（含旧数据仅打 delayed 标）恒为 0，
 *  由视图按 >0 自动叠加「逾期 N 天」徽章；随时间自然恢复，不写库不留痕 */
export function overdueDays(task: Task, todayStr: string) {
  if (task.status === 'done' || task.status === 'cancelled' || task.status === 'delayed' || task.delayed) return 0
  const d = (task.deadline ?? task.endAt).slice(0, 10)
  const diff = Math.round((+new Date(todayStr) - +new Date(d)) / 86400000)
  return diff > 0 ? diff : 0
}
