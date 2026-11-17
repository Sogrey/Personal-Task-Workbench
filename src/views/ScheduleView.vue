<script setup lang="ts">
import GanttChart from '@/components/dashboard/GanttChart.vue'
import MiniCalendar from '@/components/dashboard/MiniCalendar.vue'
</script>

<template>
  <div class="page">
    <!-- 三张独立卡片横向等高排列：说明 / 图例与注意事项 / 小日历 -->
    <div class="top-row">
      <section class="card intro">
        <div class="card-title">
          <span>日程安排</span>
          <span class="muted">甘特图视角</span>
        </div>
        <p class="lead">
          每行一个任务，任务条横向表示起止时刻与跨天时长，红色竖线标注当前时刻，
          帮助直观掌握「哪天最满、哪些任务并行、还剩多少时间」。
        </p>

        <div class="sec">
          <h4>如何阅读</h4>
          <ul>
            <li>顶行为周一至周日；每天下方标注工作时段的起始、午间、结束三个时刻</li>
            <li>任务条起点 = 开始时间，终点 = 结束时间；条内文字为完整起止时刻</li>
            <li>跨天任务（如 11/17 15:00 – 11/18 11:00）会连续跨越对应的日期列</li>
            <li>点击左侧任务名可跳转任务管理页并展开任务详情</li>
          </ul>
        </div>
      </section>

      <section class="card notes">
        <div class="card-title">
          <span>颜色标识与注意事项</span>
          <span class="muted">图例 · 操作提示</span>
        </div>
        <div class="legend">
          <span><i class="sw dot-blue" />待处理</span>
          <span><i class="sw dot-green" />进行中</span>
          <span><i class="sw dot-purple" />待确认</span>
          <span><i class="sw dot-orange" />时间重叠（可并行）</span>
          <span><i class="sw dot-gray" />已完成</span>
          <span><i class="sw dot-line" />现在时刻</span>
        </div>

        <div class="sec">
          <h4>注意事项</h4>
          <ul>
            <li>时间重叠不是错误：任务支持并行处理，橙色仅提醒留意安排冲突</li>
            <li>悬浮任务条可查看负责人、对接人、项目、备注等完整信息</li>
            <li>「回到此刻」可将视图快速定位到今天当前时间附近</li>
            <li>时间轴范围（默认 08:00–18:00）可在系统设置中调整并即时生效</li>
            <li>窄屏下可横向滚动查看整周，不会压缩任务条宽度</li>
          </ul>
        </div>
      </section>

      <MiniCalendar class="calendar-card" />
    </div>

    <GanttChart />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.top-row {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 7fr) minmax(260px, 4fr);
  gap: 14px;
  align-items: stretch;
}

.intro,
.notes {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  text-align: left;
}

.intro .card-title,
.notes .card-title {
  margin-bottom: 10px;
}

.intro p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.lead {
  line-height: 1.65;
}

.sec {
  margin-top: 12px;
}

.sec h4 {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--text);
}

.sec ul {
  margin: 0;
  padding-left: 18px;
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.7;
}

.legend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sw {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 4px;
  flex: none;
}

.dot-blue {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.6);
  border-left: 3px solid #3b82f6;
}

.dot-orange {
  background: rgba(245, 158, 11, 0.16);
  border: 1px solid rgba(245, 158, 11, 0.5);
  border-left: 3px solid #f59e0b;
}

.dot-green {
  background: rgba(16, 185, 129, 0.16);
  border: 1px solid rgba(16, 185, 129, 0.5);
  border-left: 3px solid #10b981;
}

.dot-purple {
  background: rgba(139, 92, 246, 0.16);
  border: 1px solid rgba(139, 92, 246, 0.5);
  border-left: 3px solid #8b5cf6;
}

.dot-gray {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-left: 3px solid #94a3b8;
}

.dot-line {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--danger);
}

/* 日历卡片撑满同排高度，日期格均匀拉伸 */
.calendar-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.calendar-card :deep(.days) {
  flex: 1;
  grid-auto-rows: 1fr;
}

.calendar-card :deep(.day) {
  height: 100%;
  min-height: 32px;
}

@media (max-width: 1200px) {
  .top-row {
    grid-template-columns: 1fr;
  }

  .calendar-card :deep(.weekdays),
  .calendar-card :deep(.days) {
    max-width: 420px;
  }
}
</style>