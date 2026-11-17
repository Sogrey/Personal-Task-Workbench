import type { Tag } from '@/types'

/** 预置标签（PRD 5.5）。数据清空/重置时恢复这组默认标签。 */
export const DEFAULT_TAGS: Tag[] = [
  { id: 'tag-client', name: '客户相关', color: '#3b82f6' },
  { id: 'tag-urgent', name: '重要紧急', color: '#ef4444' },
  { id: 'tag-meeting', name: '会议相关', color: '#8b5cf6' },
  { id: 'tag-product', name: '产品需求', color: '#10b981' },
  { id: 'tag-docs', name: '文档整理', color: '#f59e0b' },
  { id: 'tag-follow', name: '后续跟进', color: '#06b6d4' },
]
