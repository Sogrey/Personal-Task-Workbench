<script setup lang="ts">
import WeeklySchedule from '@/components/dashboard/WeeklySchedule.vue'
import TodayTimeline from '@/components/dashboard/TodayTimeline.vue'
import MiniCalendar from '@/components/dashboard/MiniCalendar.vue'
</script>

<template>
  <div class="page">
    <section class="intro card">
      <h2>日程安排</h2>
      <p>按周查看任务分布，会议、交付、沟通时间一目了然；冲突块会以红色高亮。</p>
    </section>
    <div class="layout">
      <WeeklySchedule />
      <aside>
        <MiniCalendar />
        <TodayTimeline />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.intro {
  padding: 18px 20px;
}

.intro h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.intro p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr);
  gap: 14px;
}

aside {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
