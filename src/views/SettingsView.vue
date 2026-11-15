<script setup lang="ts">
import { reactive } from 'vue'
import { WORKBENCH_TODAY } from '@/data/mock'

const prefs = reactive({
  workStart: '08:00',
  workEnd: '18:00',
  dueSoonHours: 24,
  displayName: '我',
})
</script>

<template>
  <div class="page">
    <section class="intro card">
      <h2>系统设置</h2>
      <p>本地偏好（原型阶段，刷新后恢复默认 mock 数据；偏好仅保存在当前会话）。</p>
    </section>

    <section class="card panel">
      <div class="form-grid">
        <div class="field">
          <label>显示名称</label>
          <input v-model="prefs.displayName" />
        </div>
        <div class="field">
          <label>工作台基准日</label>
          <input :value="WORKBENCH_TODAY" disabled />
        </div>
        <div class="field">
          <label>工作日开始</label>
          <input v-model="prefs.workStart" type="time" />
        </div>
        <div class="field">
          <label>工作日结束</label>
          <input v-model="prefs.workEnd" type="time" />
        </div>
        <div class="field">
          <label>临期提醒窗口（小时）</label>
          <input v-model.number="prefs.dueSoonHours" type="number" min="1" max="72" />
        </div>
      </div>
      <p class="note">后续可接入 localStorage / 后端配置。当前 UI 用于对齐信息架构。</p>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.intro,
.panel {
  padding: 18px;
}

.intro h2 {
  margin: 0 0 6px;
}

.intro p,
.note {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

@media (max-width: 800px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
