<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useWorkbenchStore, type WorkbenchPrefs } from '@/stores/workbench'

const store = useWorkbenchStore()

const draft = reactive<WorkbenchPrefs>({ ...store.prefs })
const savedAt = ref('')

/** 是否有未保存修改 */
const dirty = computed(
  () =>
    draft.displayName !== store.prefs.displayName ||
    draft.ownerName !== store.prefs.ownerName ||
    draft.workStart !== store.prefs.workStart ||
    draft.workEnd !== store.prefs.workEnd ||
    draft.dueSoonHours !== store.prefs.dueSoonHours,
)

const invalidTime = computed(() => draft.workEnd <= draft.workStart)

function clearData() {
  if (!window.confirm('确定清空本地数据吗？将删除全部任务、项目与历史记录，并恢复默认标签，该操作不可撤销。')) {
    return
  }
  store.resetLocalData()
}

function save() {
  if (invalidTime.value) return
  if (draft.dueSoonHours < 1 || draft.dueSoonHours > 72) {
    draft.dueSoonHours = Math.min(72, Math.max(1, Math.round(draft.dueSoonHours || 24)))
  }
  store.savePrefs({ ...draft })
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  savedAt.value = `已保存 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  window.setTimeout(() => (savedAt.value = ''), 3000)
}

function resetDefaults() {
  draft.displayName = '我'
  draft.ownerName = '苏朝恒'
  draft.workStart = '08:00'
  draft.workEnd = '18:00'
  draft.dueSoonHours = 24
}
</script>

<template>
  <div class="page">
    <section class="intro card">
      <h2>系统设置</h2>
      <p>个人资料与工作偏好。设置保存到浏览器本地（localStorage），刷新与重启后保留；工作时段与临期窗口对所有页面即时生效。</p>
    </section>

    <section class="card panel">
      <div class="card-title">
        <span>工作偏好</span>
        <span v-if="dirty" class="dirty-hint">有未保存的修改</span>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>显示名称（顶栏展示）</label>
          <input v-model="draft.displayName" placeholder="你的名字" />
        </div>
        <div class="field">
          <label>任务默认负责人（新建任务预填、报告署名）</label>
          <input v-model="draft.ownerName" placeholder="新建任务时默认填入的负责人" />
        </div>
        <div class="field">
          <label>工作台基准日（自动取系统日期）</label>
          <input :value="store.today" disabled />
        </div>
        <div class="field">
          <label>工作日开始（甘特图/周视图时间轴起点）</label>
          <input v-model="draft.workStart" type="time" />
        </div>
        <div class="field">
          <label>工作日结束（时间轴终点）</label>
          <input v-model="draft.workEnd" type="time" />
        </div>
        <div class="field">
          <label>临期提醒窗口（小时，1–72）</label>
          <input v-model.number="draft.dueSoonHours" type="number" min="1" max="72" />
        </div>
      </div>
      <p v-if="invalidTime" class="error-hint">工作日结束时间必须晚于开始时间</p>
      <p class="note">临期窗口控制总览「今日临期交付」的判定范围：截止时间在未来 {{ store.prefs.dueSoonHours }} 小时内的任务会被列出。</p>
      <div class="actions">
        <button class="btn" type="button" @click="resetDefaults">恢复默认</button>
        <span v-if="savedAt" class="saved-toast">{{ savedAt }}</span>
        <button class="btn btn-primary" type="button" :disabled="!dirty || invalidTime" @click="save">
          保存设置
        </button>
      </div>
    </section>

    <section class="card panel">
      <div class="card-title">
        <span>本地数据</span>
        <span class="muted">
          任务 {{ store.tasks.length }} · 项目 {{ store.projects.length }} · 标签
          {{ store.tags.length }} · 历史 {{ store.history.length }} 条
        </span>
      </div>
      <div class="data-row">
        <p class="note">
          数据仅保存在本机浏览器，不上传任何服务器。清空后任务、项目与历史记录将被删除，并恢复默认标签。
        </p>
        <button class="btn btn-danger" type="button" @click="clearData">清空本地数据</button>
      </div>
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
  margin-bottom: 6px;
}

.dirty-hint {
  font-size: 12px;
  color: #d97706;
  font-weight: 500;
}

.error-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--danger);
}

.note {
  margin-top: 10px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}

.saved-toast {
  font-size: 12px;
  color: #16a34a;
  font-weight: 500;
}

.data-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.data-row .note {
  flex: 1;
  min-width: 240px;
  margin-top: 0;
}

.btn-danger {
  border-color: var(--danger);
  color: var(--danger);
  background: var(--danger-soft);
}

.btn-danger:hover {
  background: #fee2e2;
  border-color: var(--danger);
}

@media (max-width: 800px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
