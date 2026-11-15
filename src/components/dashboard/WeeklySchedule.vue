<script setup lang="ts">
import { computed } from 'vue'
import { formatTimeRange, useWorkbenchStore } from '@/stores/workbench'
import type { Task } from '@/types'
import { toLocalDateKey } from '@/utils/date'

const store = useWorkbenchStore()

const HOUR_START = 8
const HOUR_END = 18
const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)

const weekLabel = computed(() => {
  const days = store.weekDays
  const a = days[0]
  const b = days[6]
  if (!a || !b) return ''
  return `${a.getMonth() + 1}月${a.getDate()}日 – ${b.getMonth() + 1}月${b.getDate()}日`
})

const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899']

function dayKey(d: Date) {
  return toLocalDateKey(d)
}

function isToday(d: Date) {
  return dayKey(d) === store.today
}

function tasksForDay(d: Date) {
  const key = dayKey(d)
  return store.weekTasks.filter((t) => t.startAt.slice(0, 10) === key)
}

function blockStyle(task: Task) {
  const start = new Date(task.startAt)
  const end = new Date(task.endAt)
  const startMin = (start.getHours() - HOUR_START) * 60 + start.getMinutes()
  const endMin = (end.getHours() - HOUR_START) * 60 + end.getMinutes()
  const total = (HOUR_END - HOUR_START) * 60
  const top = Math.max(0, (startMin / total) * 100)
  const height = Math.max(8, ((endMin - startMin) / total) * 100)
  const conflict = store.conflictTaskIds.has(task.id)
  const color = conflict
    ? '#ef4444'
    : colorPalette[Math.abs(hash(task.id)) % colorPalette.length]
  return {
    top: `${top}%`,
    height: `${height}%`,
    background: conflict ? 'rgba(239,68,68,0.12)' : `${color}22`,
    borderColor: color,
    color: conflict ? '#b91c1c' : '#1f2937',
  }
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

function selectDay(d: Date) {
  store.setSelectedDate(dayKey(d))
}
</script>

<template>
  <section class="card weekly">
    <div class="card-title">
      <span>周日程安排</span>
      <div class="tools">
        <span class="muted">{{ weekLabel }}</span>
        <button class="btn btn-ghost" type="button" @click="store.shiftWeek(-1)">‹</button>
        <button class="btn" type="button" @click="store.goTodayWeek()">今天</button>
        <button class="btn btn-ghost" type="button" @click="store.shiftWeek(1)">›</button>
      </div>
    </div>

    <div class="grid-wrap">
      <div class="time-col">
        <div class="corner" />
        <div v-for="h in hours" :key="h" class="time-cell">
          {{ String(h).padStart(2, '0') }}:00
        </div>
      </div>

      <div
        v-for="(day, idx) in store.weekDays"
        :key="dayKey(day)"
        class="day-col"
        :class="{ today: isToday(day), selected: dayKey(day) === store.selectedDate }"
        @click="selectDay(day)"
      >
        <div class="day-head">
          <div>{{ weekdayNames[idx] }}</div>
          <strong>{{ day.getDate() }}</strong>
        </div>
        <div class="day-body">
          <div v-for="h in hours" :key="h" class="slot" />
          <div
            v-for="task in tasksForDay(day)"
            :key="task.id"
            class="block"
            :class="{ conflict: store.conflictTaskIds.has(task.id) }"
            :style="blockStyle(task)"
            :title="`${task.title} ${formatTimeRange(task.startAt, task.endAt)}`"
          >
            <div class="block-title">{{ task.title }}</div>
            <div class="block-meta">{{ formatTimeRange(task.startAt, task.endAt) }} · {{ task.owner }}</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.weekly {
  padding: 16px;
}

.tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.grid-wrap {
  display: grid;
  grid-template-columns: 56px repeat(7, minmax(0, 1fr));
  gap: 4px;
  overflow-x: auto;
}

.corner {
  height: 48px;
}

.time-cell {
  height: 42px;
  font-size: 11px;
  color: var(--text-secondary);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 6px;
}

.day-col {
  min-width: 0;
  border-radius: 10px;
  cursor: pointer;
}

.day-col.selected .day-head,
.day-col.today .day-head {
  background: var(--primary-soft);
}

.day-col.today strong {
  color: var(--primary);
}

.day-head {
  height: 48px;
  border-radius: 10px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.day-head strong {
  font-size: 16px;
  color: var(--text);
}

.day-body {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(180deg, #fff, #fafbfc);
}

.slot {
  height: 42px;
  border-bottom: 1px dashed #eef2f7;
}

.slot:last-child {
  border-bottom: none;
}

.block {
  position: absolute;
  left: 4px;
  right: 4px;
  border-left: 3px solid;
  border-radius: 6px;
  padding: 4px 6px;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.3;
  z-index: 1;
}

.block.conflict {
  box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.35);
}

.block-title {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block-meta {
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
