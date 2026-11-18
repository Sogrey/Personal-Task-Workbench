<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  formatShortDate,
  formatTimeRange,
  priorityLabel,
  statusLabel,
  useWorkbenchStore,
} from '@/stores/workbench'
import type { Task, TaskPriority, TaskStatus } from '@/types'
import { overdueDays } from '@/utils/date'
import { statusBadgeClass } from '@/utils/status'
import TaskDetailDrawer from '@/components/common/TaskDetailDrawer.vue'

const store = useWorkbenchStore()
const route = useRoute()
const router = useRouter()

const statusFilter = ref<TaskStatus | 'all'>('all')
const priorityFilter = ref<TaskPriority | 'all'>('all')
const dateFrom = ref('')
const dateTo = ref('')
const projectFilter = ref(typeof route.query.projectId === 'string' ? route.query.projectId : '')
const tagFilter = ref(typeof route.query.tag === 'string' ? route.query.tag : '')
const keyword = ref(typeof route.query.q === 'string' ? route.query.q : '')
const showForm = ref(false)
const editingId = ref<string | null>(null) // 非空 = 编辑模式，对应任务 id

watch(
  () => route.query,
  (q) => {
    if (typeof q.projectId === 'string') projectFilter.value = q.projectId
    if (typeof q.tag === 'string') tagFilter.value = q.tag
    if (typeof q.q === 'string') keyword.value = q.q
  },
)

const form = reactive({
  title: '',
  projectId: store.projects[0]?.id ?? '',
  owner: store.prefs.ownerName,
  contact: '',
  description: '',
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
    if (priorityFilter.value !== 'all' && t.priority !== priorityFilter.value) return false
    if (projectFilter.value && t.projectId !== projectFilter.value) return false
    if (tagFilter.value && !t.tagIds.includes(tagFilter.value)) return false
    // 按任务开始时间落在所选日期区间过滤
    if (dateFrom.value && t.startAt.slice(0, 10) < dateFrom.value) return false
    if (dateTo.value && t.startAt.slice(0, 10) > dateTo.value) return false
    if (!q) return true
    const project = store.projectById(t.projectId)?.name ?? ''
    const tagText = t.tagIds.map((id) => store.tagById(id)?.name ?? '').join(' ')
    return [t.title, t.owner, t.contact ?? '', t.description ?? '', project, tagText].join(' ').toLowerCase().includes(q)
  })
})

/* ───── BK-5：批量操作（作用于当前筛选结果） ───── */
const selectedIds = ref<Set<string>>(new Set())
const allChecked = computed(
  () => filtered.value.length > 0 && filtered.value.every((t) => selectedIds.value.has(t.id)),
)
const someChecked = computed(() => filtered.value.some((t) => selectedIds.value.has(t.id)))

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}
function toggleSelectAll() {
  selectedIds.value = allChecked.value ? new Set() : new Set(filtered.value.map((t) => t.id))
}
function clearSelection() {
  selectedIds.value = new Set()
}
/** 筛选结果变化时剔除不可见的选中项，保证批量条计数与可见行一致 */
watch(filtered, (list) => {
  const visible = new Set(list.map((t) => t.id))
  const kept = [...selectedIds.value].filter((id) => visible.has(id))
  if (kept.length !== selectedIds.value.size) selectedIds.value = new Set(kept)
})

const batchStatus = ref<TaskStatus | ''>('')
const batchProject = ref('')
function applyBatchStatus() {
  if (!batchStatus.value) return
  const status = batchStatus.value
  for (const id of selectedIds.value) store.updateTaskStatus(id, status, '批量操作')
  batchStatus.value = ''
}
function applyBatchProject() {
  if (!batchProject.value) return
  // '__none__' 哨兵值 = 不关联项目
  const projectId = batchProject.value === '__none__' ? undefined : batchProject.value
  for (const id of selectedIds.value) store.updateTask(id, { projectId }, '批量操作')
  batchProject.value = ''
}

/** 详情抽屉：支持 URL ?task=<id> 直达（其它页面链接跳入时自动展开），
 *  关闭抽屉时同步移除该参数，刷新页面仍可恢复 */
const drawerTask = ref<Task | null>(null)
const taskMissing = ref(false)
let missingTimer: number | undefined

watch(
  () => route.query.task,
  (id) => {
    if (typeof id === 'string' && id) {
      const found = store.tasks.find((t) => t.id === id)
      if (found) {
        drawerTask.value = found
        taskMissing.value = false
      } else {
        // 任务已删除（历史记录等入口可能指向不存在的任务）
        drawerTask.value = null
        taskMissing.value = true
        window.clearTimeout(missingTimer)
        missingTimer = window.setTimeout(() => (taskMissing.value = false), 5000)
        router.replace({ query: { ...route.query, task: undefined } })
      }
    } else {
      // query.task 被移除（关闭抽屉 / 抽屉内跳转筛选 / 浏览器后退） → 同步收起抽屉
      drawerTask.value = null
    }
  },
  { immediate: true },
)

function clearTaskQuery() {
  if (typeof route.query.task === 'string') {
    router.replace({ query: { ...route.query, task: undefined } })
  }
}

function onView(task: Task) {
  drawerTask.value = task
  router.replace({ query: { ...route.query, task: task.id } })
}

function closeDrawer() {
  drawerTask.value = null
  clearTaskQuery()
}

function onDrawerEdit(task: Task) {
  drawerTask.value = null
  clearTaskQuery()
  startEdit(task)
}

onBeforeUnmount(() => window.clearTimeout(missingTimer))

function clearDateFilter() {
  dateFrom.value = ''
  dateTo.value = ''
}

function toggleTag(id: string) {
  const i = form.tagIds.indexOf(id)
  if (i >= 0) form.tagIds.splice(i, 1)
  else form.tagIds.push(id)
}

/** datetime-local 的值本身是本地时间（如 2026-11-16T09:00），直接存无时区后缀的本地 ISO，
 * 与 store 的本地解析约定一致；不能用 toISOString()（会转成 UTC，显示时错位）。 */
function toLocalIso(value: string, fallbackTime: string) {
  if (value.length >= 16) return `${value.slice(0, 16)}:00`
  return `${store.today}T${fallbackTime}`
}

/** 编辑模式：用任务现值回填表单（datetime-local 需 trim 秒） */
function startEdit(task: Task) {
  editingId.value = task.id
  showForm.value = true
  form.title = task.title
  form.projectId = task.projectId ?? ''
  form.owner = task.owner
  form.contact = task.contact ?? ''
  form.description = task.description ?? ''
  form.startAt = task.startAt.slice(0, 16)
  form.endAt = task.endAt.slice(0, 16)
  form.deadline = (task.deadline ?? task.endAt).slice(0, 16)
  form.priority = task.priority
  form.status = task.status
  form.tagIds = [...task.tagIds]
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}

function resetForm() {
  editingId.value = null
  form.title = ''
  form.projectId = ''
  form.owner = store.prefs.ownerName
  form.contact = ''
  form.description = ''
  form.startAt = `${store.today}T09:00`
  form.endAt = `${store.today}T10:00`
  form.deadline = `${store.today}T18:00`
  form.priority = 'medium'
  form.status = 'pending'
  form.tagIds = []
}

function toggleForm() {
  if (showForm.value && editingId.value) {
    // 编辑模式下点按钮 = 取消编辑
    cancelEdit()
  } else {
    resetForm()
    showForm.value = !showForm.value
  }
}

function cancelEdit() {
  showForm.value = false
  editingId.value = null
  resetForm()
}

/* ───── FIX-3：时间字段语义与先后校验 ───── */
/** 结束早于开始 → 硬校验，禁止保存 */
const endBeforeStart = computed(() => !!form.endAt && !!form.startAt && form.endAt < form.startAt)
/** 截止早于开始 → 软警示，允许保存（兼容历史数据） */
const deadlineBeforeStart = computed(
  () => !!form.deadline && !!form.startAt && form.deadline < form.startAt,
)

/** 列表行内常驻警示：已保存任务的截止早于开始 */
function taskDeadlineBeforeStart(task: Task) {
  return !!(task.deadline && task.deadline < task.startAt)
}

function submit() {
  if (!form.title.trim()) return
  // FIX-3 硬校验：结束不早于开始，否则拦截保存
  if (endBeforeStart.value) return
  const payload = {
    title: form.title.trim(),
    projectId: form.projectId || undefined,
    owner: form.owner,
    contact: form.contact.trim() || undefined,
    description: form.description.trim() || undefined,
    startAt: toLocalIso(form.startAt, '09:00:00'),
    endAt: toLocalIso(form.endAt, '10:00:00'),
    deadline: toLocalIso(form.deadline, '18:00:00'),
    priority: form.priority,
    status: form.status,
    tagIds: [...form.tagIds],
  }
  if (editingId.value) {
    store.updateTask(editingId.value, payload)
  } else {
    store.addTask(payload)
  }
  resetForm()
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
          <option value="delayed">延期处理</option>
          <option value="done">已完成</option>
        </select>
        <select v-model="priorityFilter">
          <option value="all">全部优先级</option>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="urgent">紧急</option>
        </select>
        <select v-model="projectFilter">
          <option value="">全部项目</option>
          <option v-for="p in store.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <select v-model="tagFilter">
          <option value="">全部标签</option>
          <option v-for="tag in store.tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
        </select>
        <div class="date-range">
          <input v-model="dateFrom" type="date" title="开始日期" />
          <span class="dash">–</span>
          <input v-model="dateTo" type="date" title="结束日期" />
          <button
            v-if="dateFrom || dateTo"
            class="btn btn-ghost clear-btn"
            type="button"
            title="清除日期筛选"
            @click="clearDateFilter"
          >
            ✕
          </button>
        </div>
      </div>
      <button class="btn btn-primary" type="button" @click="toggleForm">
        {{ showForm ? (editingId ? '取消编辑' : '收起') : '新建任务' }}
      </button>
    </div>

    <!-- BK-5：批量操作条（有选中项时显示） -->
    <section v-if="selectedIds.size" class="card batch-bar">
      <span class="batch-count">已选 {{ selectedIds.size }} 项</span>
      <div class="batch-actions">
        <select v-model="batchStatus" class="batch-select" title="批量修改状态">
          <option value="">批量改状态…</option>
          <option value="pending">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="to_confirm">待确认</option>
          <option value="delayed">延期处理</option>
          <option value="done">已完成</option>
        </select>
        <button class="btn" type="button" :disabled="!batchStatus" @click="applyBatchStatus">应用</button>
        <select v-model="batchProject" class="batch-select" title="批量修改项目">
          <option value="">批量改项目…</option>
          <option value="__none__">不关联项目</option>
          <option v-for="p in store.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
        <button class="btn" type="button" :disabled="!batchProject" @click="applyBatchProject">应用</button>
        <button class="btn btn-ghost" type="button" @click="clearSelection">清除选择</button>
      </div>
    </section>

    <section v-if="showForm" class="card form-card">
      <h3>{{ editingId ? '编辑任务' : '新建任务' }}</h3>
      <div class="form-grid">
        <div class="field">
          <label>标题</label>
          <input v-model="form.title" placeholder="今天要做什么？" />
        </div>
        <div class="field">
          <label>项目（可选）</label>
          <select v-model="form.projectId">
            <option value="">不关联项目</option>
            <option v-for="p in store.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>负责人</label>
          <input v-model="form.owner" />
        </div>
        <div class="field">
          <label>对接人（可选）</label>
          <input v-model="form.contact" placeholder="客户/协作方联系人" />
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
            <option value="delayed">延期处理</option>
          </select>
        </div>
        <div class="field span-all">
          <label>备注（可选）</label>
          <textarea
            v-model="form.description"
            rows="2"
            placeholder="补充说明、注意事项、沟通记录等"
          />
        </div>
        <div class="field span-all time-explain">
          <p class="muted">「开始/结束」= 计划执行时段（占哪天的哪几个小时，驱动日历色块与时间投入）；「截止」= 完成期限（最晚交付时间，驱动逾期与临期提醒），可与执行时段无关。</p>
          <p v-if="endBeforeStart" class="hard-warn">⚠ 结束时间需不早于开始时间，请修正后再保存</p>
          <p v-else-if="deadlineBeforeStart" class="soft-warn">⚠ 截止早于开始时间，请确认是否正确（仍可保存）</p>
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
        <button class="btn" type="button" @click="cancelEdit">{{ editingId ? '取消编辑' : '取消' }}</button>
        <button class="btn btn-primary" type="button" :disabled="!form.title.trim() || endBeforeStart" @click="submit">
          {{ editingId ? '保存修改' : '保存到工作台' }}
        </button>
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
              <th class="check-col">
                <input
                  type="checkbox"
                  :checked="allChecked"
                  :indeterminate="someChecked && !allChecked"
                  title="全选当前筛选结果"
                  @change="toggleSelectAll"
                />
              </th>
              <th>任务</th>
              <th>项目</th>
              <th>负责人</th>
              <th>对接人</th>
              <th>时间</th>
              <th>截止</th>
              <th>优先级</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in filtered" :key="task.id" :class="{ selected: selectedIds.has(task.id) }">
              <td class="check-col">
                <input
                  type="checkbox"
                  :checked="selectedIds.has(task.id)"
                  :title="`选择「${task.title}」`"
                  @change="toggleSelect(task.id)"
                />
              </td>
              <td>
                <div class="title tappable" role="link" tabindex="0" @click="onView(task)" @keydown.enter="onView(task)">
                  {{ task.title }}
                </div>
                <div v-if="taskDeadlineBeforeStart(task)" class="time-warn">⚠ 截止早于开始</div>
                <p v-if="task.description" class="note">{{ task.description }}</p>
                <div class="tags">
                  <button
                    v-for="id in task.tagIds"
                    :key="id"
                    type="button"
                    class="mini-tag"
                    :class="{ active: tagFilter === id }"
                    :style="{ background: store.tagById(id)?.color }"
                    :title="`按标签「${store.tagById(id)?.name ?? id}」筛选`"
                    @click="tagFilter = tagFilter === id ? '' : id"
                  >
                    {{ store.tagById(id)?.name }}
                  </button>
                </div>
              </td>
              <td>
                <button
                  v-if="task.projectId"
                  type="button"
                  class="link-btn"
                  :title="`按项目「${store.projectById(task.projectId)?.name}」筛选`"
                  @click="projectFilter = projectFilter === task.projectId ? '' : (task.projectId ?? '')"
                >
                  {{ store.projectById(task.projectId)?.name }}
                </button>
                <template v-else>—</template>
              </td>
              <td>{{ task.owner }}</td>
              <td>{{ task.contact || '—' }}</td>
              <td>{{ formatTimeRange(task.startAt, task.endAt) }}</td>
              <td>{{ formatShortDate(task.deadline ?? task.endAt) }}</td>
              <td>{{ priorityLabel(task.priority) }}</td>
              <td>
                <span :class="statusBadgeClass(task.status)">{{ statusLabel(task.status) }}</span>
                <!-- 旧数据仅打 delayed 标（status 未迁移）时补充红标；status=delayed 已由紫色状态徽章表达 -->
                <span v-if="task.delayed && task.status !== 'delayed'" class="badge badge-danger delay-badge">延期</span>
                <!-- FIX-6：逾期派生徽章（不写库），随时间自然恢复 -->
                <span v-if="overdueDays(task, store.today) > 0" class="badge badge-danger delay-badge">
                  逾期 {{ overdueDays(task, store.today) }} 天
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-ghost view-btn" type="button" @click="onView(task)">查看</button>
                  <button
                    class="btn btn-ghost edit-btn"
                    type="button"
                    :class="{ editing: editingId === task.id }"
                    @click="startEdit(task)"
                  >
                    {{ editingId === task.id ? '编辑中' : '编辑' }}
                  </button>
                  <select
                    class="status-select"
                    :value="task.status"
                    @change="store.updateTaskStatus(task.id, ($event.target as HTMLSelectElement).value as TaskStatus)"
                  >
                    <option value="pending">待处理</option>
                    <option value="in_progress">进行中</option>
                    <option value="to_confirm">待确认</option>
                    <option value="delayed">延期处理</option>
                    <option value="done">已完成</option>
                  </select>
                </div>
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="10" class="empty-hint">暂无符合条件的任务，点击右上角「新建任务」开始安排</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="taskMissing" class="missing-hint card">未找到对应的任务，可能已被删除或数据未同步</div>

    <TaskDetailDrawer :task="drawerTask" @close="closeDrawer" @edit="onDrawerEdit" />
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

.form-grid .span-all {
  grid-column: 1 / -1;
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

.title.tappable {
  color: var(--info);
  cursor: pointer;
}

.title.tappable:hover {
  text-decoration: underline;
}

/* FIX-3：时间语义说明与校验提示 */
.time-explain {
  grid-column: 1 / -1;
  background: #f8fafc;
  border-radius: 10px;
  padding: 10px 14px;
}

.time-explain .muted {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}

.time-explain .hard-warn {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--danger);
  font-weight: 600;
}

.time-explain .soft-warn {
  margin: 6px 0 0;
  font-size: 12px;
  color: #b45309;
  font-weight: 600;
}

.time-warn {
  font-size: 11px;
  color: #b45309;
  margin-bottom: 4px;
}

.missing-hint {
  padding: 10px 16px;
  font-size: 13px;
  color: #b45309;
  background: var(--warning-soft);
}

.note {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  max-width: 380px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.view-btn {
  padding: 0 10px;
  height: 32px;
  font-size: 12px;
  color: var(--info);
}

.date-range {
  display: flex;
  align-items: center;
  gap: 4px;
}

.date-range input {
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 8px;
  background: #fff;
  font-size: 12px;
  color: var(--text);
  width: 128px;
}

.dash {
  color: var(--text-secondary);
}

.clear-btn {
  height: 30px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.edit-btn {
  padding: 0 10px;
  height: 32px;
  font-size: 12px;
  color: var(--primary);
}

.edit-btn.editing {
  background: var(--primary-soft);
  color: #166534;
  font-weight: 600;
}

.delay-badge {
  margin-left: 6px;
}

/* BK-5：批量操作条与选择列 */
.batch-bar {
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  border-left: 4px solid var(--primary);
}

.batch-count {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  white-space: nowrap;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.batch-select {
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
  font-size: 13px;
}

.check-col {
  width: 36px;
  padding-right: 0;
}

.check-col input {
  width: 15px;
  height: 15px;
  accent-color: var(--primary);
  cursor: pointer;
}

.data-table tbody tr.selected td {
  background: var(--primary-soft);
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
  border: none;
  cursor: pointer;
}

.mini-tag.active {
  outline: 2px solid currentColor;
  outline-offset: 1px;
}

@media (max-width: 1100px) {
  .form-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
