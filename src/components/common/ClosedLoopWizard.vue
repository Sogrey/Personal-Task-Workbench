<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { statusLabel, useWorkbenchStore } from '@/stores/workbench'
import type { ClosedLoopItem } from '@/utils/report'
import { statusBadgeClass } from '@/utils/status'

const props = defineProps<{
  items: ClosedLoopItem[]
  /** must：闭环确认（C/B1/A2）；optional：可选进展采集（B2） */
  mode: 'must' | 'optional'
  today: string
}>()
const emit = defineEmits<{ close: []; done: [] }>()

const store = useWorkbenchStore()

/** 快照：向导进行中父级 items 会随确认动作重算（如延期后退出必答组），
 *  以打开时的列表为准，避免索引错位重排 */
const list = ref([...props.items])
const idx = ref(0)
const current = computed(() => list.value[idx.value] ?? null)
const total = computed(() => list.value.length)

/** 表单状态：当前选项 / 补录完成日 / 说明文本 */
const choice = ref<string | null>(null)
const completeDate = ref(props.today)
const note = ref('')
const doneCount = ref(0)

function resetForm() {
  choice.value = null
  completeDate.value = props.today
  note.value = ''
}

function next() {
  if (idx.value < total.value - 1) {
    idx.value++
    resetForm()
  } else {
    emit('done')
  }
}

function prev() {
  if (idx.value > 0) {
    idx.value--
    resetForm()
  }
}

function apply() {
  const item = current.value
  if (!item || !choice.value) return
  const id = item.task.id
  switch (choice.value) {
    case 'done':
      store.completeTask(id, completeDate.value)
      doneCount.value++
      break
    case 'progress':
      // 已在进行中的只追加进展；未开始的标记已开始
      if (item.task.status === 'in_progress') store.addProgressNote(id, note.value)
      else store.markStarted(id, note.value || undefined)
      doneCount.value++
      break
    case 'delayed':
      store.markDelayed(id, note.value || undefined)
      doneCount.value++
      break
    case 'note':
      store.addProgressNote(id, note.value)
      doneCount.value++
      break
    case 'keep':
      store.confirmEarlyStart(id, true)
      doneCount.value++
      break
    case 'revert':
      store.confirmEarlyStart(id, false)
      doneCount.value++
      break
  }
  next()
}

function skip() {
  next()
}

/** 选项集（按用例类型） */
interface Option {
  key: string
  label: string
  desc?: string
  needDate?: boolean
  needNote?: boolean
  /** 拓展为可选：展示输入框但允许空提交 */
  noteOptional?: boolean
}

const options = computed<Option[]>(() => {
  const kind = current.value?.kind
  if (kind === 'overdue_open' || kind === 'not_started') {
    return [
      { key: 'done', label: '已完成', desc: '补录实际完成日期（默认今天）', needDate: true },
      { key: 'progress', label: '进行中，记录进展', desc: '说明当前进展情况', needNote: true },
      { key: 'delayed', label: '未开始，延期处理', desc: '状态置为延期处理，不改动计划时间；顺延请在任务列表编辑', needNote: true, noteOptional: true },
    ]
  }
  if (kind === 'progress_probe') {
    return [
      { key: 'done', label: '已完成', needDate: true },
      { key: 'note', label: '记录进展说明', needNote: true },
    ]
  }
  // early_start
  return [
    { key: 'keep', label: '确实提前开始', desc: '保留当前进行中状态' },
    { key: 'revert', label: '误标记，改回待处理' },
  ]
})

const needSubmit = computed(() => {
  if (!choice.value) return false
  const opt = options.value.find((o) => o.key === choice.value)
  if (!opt) return false
  if (opt.needNote && !opt.noteOptional && !note.value.trim()) return false
  if (opt.needDate && !completeDate.value) return false
  return true
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="wizard-root" @mousedown.self="emit('close')">
      <!-- appear：弹窗即播动画 -->
      <Transition name="wiz" appear>
        <div v-if="current" class="wizard" role="dialog" aria-label="闭环确认">
          <header class="w-head">
            <div>
              <span class="w-tag">{{ mode === 'must' ? '待闭环' : '可选采集' }}</span>
              <strong>{{ mode === 'must' ? '任务闭环确认' : '进行中进展采集' }}</strong>
            </div>
            <span class="w-step">{{ idx + 1 }} / {{ total }}</span>
            <button class="w-close" type="button" aria-label="关闭" @click="emit('close')">✕</button>
          </header>

          <!-- 任务卡 -->
          <div class="task-card">
            <div class="tc-row">
              <strong class="tc-title">{{ current.task.title }}</strong>
              <span :class="statusBadgeClass(current.task.status)" class="tc-badge">
                {{ statusLabel(current.task.status) }}
              </span>
              <span v-if="current.task.delayed" class="badge badge-danger">延期</span>
            </div>
            <div class="tc-meta">
              <span>{{ store.projectById(current.task.projectId)?.name ?? '未关联项目' }}</span>
              <span>·</span>
              <span>{{ current.hint }}</span>
            </div>
          </div>

          <p class="question">{{ current.question }}</p>

          <!-- 选项 -->
          <div class="opts">
            <label
              v-for="opt in options"
              :key="opt.key"
              class="opt"
              :class="{ on: choice === opt.key }"
            >
              <input v-model="choice" type="radio" :value="opt.key" name="cl-choice" />
              <span class="opt-body">
                <span class="opt-label">{{ opt.label }}</span>
                <span v-if="opt.desc" class="opt-desc">{{ opt.desc }}</span>
              </span>
            </label>
          </div>

          <!-- 展开输入区 -->
          <div v-if="choice && options.find((o) => o.key === choice)?.needDate" class="input-row">
            <label>实际完成日期</label>
            <input v-model="completeDate" type="date" :max="today" />
            <span class="input-hint">默认今天，可补录历史完成日</span>
          </div>
          <textarea
            v-if="choice && options.find((o) => o.key === choice)?.needNote"
            v-model="note"
            rows="2"
            class="note-input"
            :placeholder="choice === 'delayed' ? '延期原因（可选）' : '进展情况说明，如：联调完成 80%，剩报表导出'"
          />

          <footer class="w-foot">
            <button class="btn btn-ghost" type="button" :disabled="idx === 0" @click="prev">上一项</button>
            <span class="foot-gap" />
            <button class="btn" type="button" @click="skip">跳过此任务</button>
            <button class="btn btn-primary" type="button" :disabled="!needSubmit" @click="apply">
              确认并下一项
            </button>
          </footer>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.wizard-root {
  position: fixed;
  inset: 0;
  z-index: 950;
  background: rgba(15, 23, 42, 0.38);
  display: grid;
  place-items: center;
  padding: 24px;
}

.wizard {
  width: min(520px, 94vw);
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22);
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.w-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.w-head > div:first-child {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.w-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--warning-soft);
  color: #b45309;
  font-weight: 700;
}

.w-head strong {
  font-size: 15px;
}

.w-step {
  font-size: 12px;
  color: var(--text-secondary);
}

.w-close {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 8px;
}

.w-close:hover {
  background: #f1f5f9;
  color: var(--text);
}

.task-card {
  padding: 12px 14px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid var(--border);
}

.tc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tc-title {
  font-size: 15px;
}

.tc-badge {
  flex: none;
}

.tc-meta {
  margin-top: 6px;
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.question {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.opts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.opt {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: 0.12s ease;
}

.opt:hover {
  border-color: #a7d7b9;
}

.opt.on {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.opt input {
  margin-top: 3px;
  accent-color: var(--primary);
}

.opt-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.opt-label {
  font-size: 13.5px;
  font-weight: 600;
}

.opt-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  flex-wrap: wrap;
}

.input-row label {
  color: var(--text-secondary);
}

.input-row input {
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
}

.input-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.note-input {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 9px 12px;
  font: inherit;
  font-size: 13px;
  resize: vertical;
}

.note-input:focus {
  outline: 2px solid var(--primary-soft);
  border-color: var(--primary);
}

.w-foot {
  display: flex;
  gap: 8px;
  align-items: center;
}

.foot-gap {
  flex: 1;
}

.w-foot .btn {
  height: 34px;
}

.wiz-enter-active {
  transition: opacity 0.18s ease, transform 0.2s ease;
}

.wiz-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.98);
}
</style>