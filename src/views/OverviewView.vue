<script setup lang="ts">
import StatCards from '@/components/dashboard/StatCards.vue'
import WeeklySchedule from '@/components/dashboard/WeeklySchedule.vue'
import MiniCalendar from '@/components/dashboard/MiniCalendar.vue'
import TodayTimeline from '@/components/dashboard/TodayTimeline.vue'
import ScheduleList from '@/components/dashboard/ScheduleList.vue'
import PendingReminders from '@/components/dashboard/PendingReminders.vue'
import TagCategories from '@/components/dashboard/TagCategories.vue'
import RecentAdjustments from '@/components/dashboard/RecentAdjustments.vue'
</script>

<template>
  <div class="overview">
    <StatCards />

    <div class="mid">
      <WeeklySchedule />
      <aside class="side">
        <MiniCalendar />
        <TodayTimeline />
      </aside>
    </div>

    <div class="lower">
      <ScheduleList />
      <PendingReminders />
      <TagCategories />
    </div>

    <RecentAdjustments />
  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr);
  gap: 14px;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.lower {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.8fr) minmax(220px, 0.8fr);
  gap: 14px;
}

@media (max-width: 1200px) {
  .mid,
  .lower {
    grid-template-columns: 1fr;
  }
}
</style>
