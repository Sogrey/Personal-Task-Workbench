<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  formatShortDate,
  formatTimeRange,
  priorityLabel,
  statusLabel,
  useWorkbenchStore,
} from '@/stores/workbench'
import type { TaskPriority, TaskStatus } from '@/types'
import { statusBadgeClass } from '@/utils/status'

const store = useWorkbenchStore()
const route = useRoute()

const statusFilter = ref<TaskStatus | 'all'>('all')
const tagFilter = ref(typeof route.query.tag === 'string' ? route.query.tag : '')
const keyword = ref(typeof route.query.q === 'string' ? route.query.q : '')
const showForm = ref(false)

watch(
  () => route.query,
  (q) => {
    if (typeof q.tag === 'string') tagFilter.value = q.tag
    if (typeof q.q === 'string') keyword.value = q.q
  },
)

const form = reactive({
  title: '',
  projectId: store.projects[0]?.id ?? '',
  owner: '小A',
  startAt: `${store.today}T09:00`,
  endAt: `${store.today}T10:00`,
  deadline: `${store.today}T18:00`,
  priority: 'medium' as TaskPriority,
  status: 'pending' as TaskStatus,
  tagIds: [] as string[],
})

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return store.tasks.filter((t) => {
    if (t.status === 'cancelled') return false
    if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false
    if (tagFilter.value && !t.tagIds.includes(tagFilter.value)) return false
    if (!q) return true
    const project = store.projectById(t.projectId)?.name ?? ''
    const tagText = t.tagIds.map((id) => store.tagById(id)?.name ?? '').join(' ')
    return [t.title, t.owner, project, tagText].join(' ').toLowerCase().includes(q)
  })
})

function toggleTag(id: string) {
  const i = form.tagIds.indexOf(id)
  if (i >= 0) form.tagIds.splice(i, 1)
  else form.tagIds.push(id)
}

function submit() {
  if (!form.title.trim()) return
  store.addTask({
    title: form.title.trim(),
    projectId: form.projectId || undefined,
    owner: form.owner,
    startAt: new Date(form.startAt).toISOString().slice(0, 19),
    endAt: new Date(form.endAt).toISOString().slice(0, 19),
    deadline: new Date(form.deadline).toISOString().slice(0, 19),
    priority: form.priority,
    status: form.status,
    tagIds: [...form.tagIds],
  })
  form.title = ''
  showForm.value = false
}
</script>

<template>
  <div class="page">
    <div class="toolbar card">
      <div class="filters">
        <input v-model="keyword" type="search" placeholder="筛选关键词" />
        <select v-model="statusFilter">
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="to_confirm">待确认</option>
          <option value="done">已完成</option>
        </select>
        <select v-model="tagFilter">
          <option value="">全部标签</option>
          <option v-for="tag in store.tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
        </select>
      </div>
      <button class="btn btn-primary" type="button" @click="showForm = !showForm">
        {{ showForm ? '收起' : '新建任务' }}
      </button>
    </div>

    <section v-if="showForm" class="card form-card">
      <h3>新建任务</h3>
      <div class="form-grid">
        <div class="field">
          <label>标题</label>
          <input v-model="form.title" placeholder="今天要做什么？" />
        </div>
        <div class="field">
          <label>项目</label>
          <select v-model="form.projectId">
            <option v-for="p in store.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>负责人</label>
          <input v-model="form.owner" />
        </div>
        <div class="field">
          <label>优先级</label>
          <select v-model="form.priority">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="urgent">紧急</option>
          </select>
        </div>
        <div class="field">
          <label>开始</label>
          <input v-model="form.startAt" type="datetime-local" />
        </div>
        <div class="field">
          <label>结束</label>
          <input v-model="form.endAt" type="datetime-local" />
        </div>
        <div class="field">
          <label>截止</label>
          <input v-model="form.deadline" type="datetime-local" />
        </div>
        <div class="field">
          <label>状态</label>
          <select v-model="form.status">
            <option value="pending">待处理</option>
            <option value="in_progress">进行中</option>
            <option value="to_confirm">待确认</option>
          </select>
        </div>
      </div>
      <div class="tag-pick">
        <button
          v-for="tag in store.tags"
          :key="tag.id"
          type="button"
          class="chip"
          :class="{ on: form.tagIds.includes(tag.id) }"
          @click="toggleTag(tag.id)"
        >
          {{ tag.name }}
        </button>
      </div>
      <div class="actions">
        <button class="btn" type="button" @click="showForm = false">取消</button>
        <button class="btn btn-primary" type="button" @click="submit">保存到工作台</button>
      </div>
    </section>

    <section class="card table-card">
      <div class="card-title">
        <span>任务列表</span>
        <span class="muted">共 {{ filtered.length }} 项</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>任务</th>
              <th>项目</th>
              <th>负责人</th>
              <th>时间</th>
              <th>截止</th>
              <th>优先级</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in filtered" :key="task.id">
              <td>
                <div class="title">{{ task.title }}</div>
                <div class="tags">
                  <span
                    v-for="id in task.tagIds"
                    :key="id"
                    class="mini-tag"
                    :style="{ background: store.tagById(id)?.color }"
                  >
                    {{ store.tagById(id)?.name }}
                  </span>
                </div>
              </td>
              <td>{{ store.projectById(task.projectId)?.name ?? '—' }}</td>
              <td>{{ task.owner }}</td>
              <td>{{ formatTimeRange(task.startAt, task.endAt) }}</td>
              <td>{{ formatShortDate(task.deadline ?? task.endAt) }}</td>
              <td>{{ priorityLabel(task.priority) }}</td>
              <td>
                <span :class="statusBadgeClass(task.status)">{{ statusLabel(task.status) }}</span>
              </td>
              <td>
                <select
                  class="status-select"
                  :value="task.status"
                  @change="store.updateTaskStatus(task.id, ($event.target as HTMLSelectElement).value as TaskStatus)"
                >
                  <option value="pending">待处理</option>
                  <option value="in_progress">进行中</option>
                  <option value="to_confirm">待确认</option>
                  <option value="done">已完成</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
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

.toolbar {
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filters input,
.filters select,
.status-select {
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
}

.form-card,
.table-card {
  padding: 16px;
}

.form-card h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.tag-pick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
}

.chip {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
}

.chip.on {
  background: var(--primary-soft);
  border-color: #86efac;
  color: #166534;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.table-wrap {
  overflow: auto;
}

.title {
  font-weight: 600;
  margin-bottom: 6px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mini-tag {
  font-size: 11px;
  color: #fff;
  border-radius: 999px;
  padding: 1px 7px;
}

@media (max-width: 1100px) {
  .form-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
