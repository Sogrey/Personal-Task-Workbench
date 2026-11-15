<script setup lang="ts">
import { computed } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'
import { toLocalDateKey } from '@/utils/date'

const store = useWorkbenchStore()

const monthDate = computed(() => new Date(store.selectedDate))

const monthLabel = computed(() => {
  const d = monthDate.value
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

const cells = computed(() => {
  const base = new Date(monthDate.value.getFullYear(), monthDate.value.getMonth(), 1)
  const firstWeekday = (base.getDay() + 6) % 7
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  const result: { date: Date | null; key: string }[] = []
  for (let i = 0; i < firstWeekday; i++) result.push({ date: null, key: `e-${i}` })
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(base.getFullYear(), base.getMonth(), d)
    result.push({ date, key: toLocalDateKey(date) })
  }
  return result
})

function iso(d: Date) {
  return toLocalDateKey(d)
}

function select(d: Date) {
  store.setSelectedDate(iso(d))
  store.weekAnchor = iso(d)
}
</script>

<template>
  <section class="card mini">
    <div class="card-title">
      <span>小日历</span>
      <span class="muted">{{ monthLabel }}</span>
    </div>
    <div class="weekdays">
      <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w">{{ w }}</span>
    </div>
    <div class="days">
      <button
        v-for="cell in cells"
        :key="cell.key"
        type="button"
        class="day"
        :class="{
          empty: !cell.date,
          today: cell.date && iso(cell.date) === store.today,
          selected: cell.date && iso(cell.date) === store.selectedDate,
        }"
        :disabled="!cell.date"
        @click="cell.date && select(cell.date)"
      >
        {{ cell.date?.getDate() ?? '' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.mini {
  padding: 16px;
}

.weekdays,
.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  text-align: center;
}

.weekdays {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.day {
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
}

.day:not(.empty):hover {
  background: #f3f4f6;
}

.day.today {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 700;
}

.day.selected {
  background: var(--primary);
  color: #fff;
  font-weight: 700;
}

.day.empty {
  cursor: default;
}
</style>
