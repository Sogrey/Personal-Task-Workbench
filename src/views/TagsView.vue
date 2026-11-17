<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#ef4444', '#64748b',
]

type DialogMode = 'create' | 'edit' | null

const dialog = ref<DialogMode>(null)
const form = reactive({ id: '', name: '', color: PRESET_COLORS[0]! })
const formError = ref('')

const editTarget = computed(() => (dialog.value === 'edit' ? store.tagById(form.id) : null))

function openCreate() {
  form.id = ''
  form.name = ''
  form.color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]!
  formError.value = ''
  dialog.value = 'create'
}

function openEdit(id: string) {
  const tag = store.tagById(id)
  if (!tag) return
  form.id = tag.id
  form.name = tag.name
  form.color = tag.color
  formError.value = ''
  dialog.value = 'edit'
}

function submit() {
  formError.value = ''
  if (!form.name.trim()) {
    formError.value = '请填写标签名称'
    return
  }
  if (dialog.value === 'create') {
    if (!store.addTag(form.name, form.color)) {
      formError.value = '该名称已存在'
      return
    }
  } else if (dialog.value === 'edit') {
    if (!store.updateTag(form.id, { name: form.name, color: form.color })) {
      formError.value = '该名称已存在'
      return
    }
  }
  dialog.value = null
}

function removeTag(id: string) {
  const tag = store.tagById(id)
  if (!tag) return
  const used = store.tagUsageCount(id)
  const tip =
    used > 0
      ? `「${tag.name}」正被 ${used} 个任务使用，无法删除。请先在任务中移除该标签。`
      : `确定删除标签「${tag.name}」吗？`
  if (!window.confirm(tip)) return
  const r = store.deleteTag(id)
  if (!r.ok && r.reason) {
    window.alert(r.reason)
  }
}
</script>

<template>
  <div class="page">
    <section class="intro card">
      <div class="intro-main">
        <h2>标签分类</h2>
        <p>客户相关、重要紧急、会议事项、后续跟进——不同任务分类管理，点击标签卡片即可筛选任务。支持自定义标签名称与颜色。</p>
      </div>
      <button class="btn btn-primary" type="button" @click="openCreate">新建标签</button>
    </section>

    <div class="grid">
      <div
        v-for="tag in store.tagStats"
        :key="tag.id"
        class="card tag-card"
        :style="{ '--tag': tag.color }"
      >
        <RouterLink class="tag-main" :to="{ path: '/tasks', query: { tag: tag.id } }">
          <div class="dot" />
          <div class="info">
            <h3>{{ tag.name }}</h3>
            <p>未完成任务 <strong>{{ tag.count }}</strong> 项</p>
          </div>
        </RouterLink>
        <div class="ops">
          <button class="op" type="button" title="编辑标签" @click="openEdit(tag.id)">✎</button>
          <button class="op danger" type="button" title="删除标签" @click="removeTag(tag.id)">🗑</button>
        </div>
      </div>

      <button class="card add-card" type="button" @click="openCreate">
        <span class="plus">＋</span>
        <span>新建标签</span>
      </button>
    </div>

    <!-- 新建/编辑对话框 -->
    <div v-if="dialog" class="mask" @mousedown.self="dialog = null">
      <div class="dialog card" role="dialog" :aria-label="dialog === 'create' ? '新建标签' : '编辑标签'">
        <h3>{{ dialog === 'create' ? '新建标签' : '编辑标签' }}</h3>
        <div class="field">
          <label>标签名称</label>
          <input
            v-model="form.name"
            placeholder="如：季度汇报"
            maxlength="10"
            @keydown.enter="submit"
          />
        </div>
        <div class="field">
          <label>颜色</label>
          <div class="colors">
            <button
              v-for="c in PRESET_COLORS"
              :key="c"
              type="button"
              class="color-dot"
              :class="{ active: form.color === c }"
              :style="{ background: c }"
              :title="c"
              @click="form.color = c"
            />
          </div>
        </div>
        <p v-if="editTarget" class="usage">当前被 {{ store.tagUsageCount(form.id) }} 个任务使用</p>
        <p v-if="formError" class="error">{{ formError }}</p>
        <div class="actions">
          <button class="btn" type="button" @click="dialog = null">取消</button>
          <button class="btn btn-primary" type="button" :disabled="!form.name.trim()" @click="submit">
            {{ dialog === 'create' ? '创建' : '保存' }}
          </button>
        </div>
      </div>
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.intro-main h2 {
  margin: 0 0 6px;
}

.intro p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  max-width: 640px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.tag-card {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: 0.15s ease;
}

.tag-card:hover {
  transform: translateY(-2px);
}

.tag-main {
  display: flex;
  gap: 14px;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.dot {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--tag);
  opacity: 0.9;
  flex-shrink: 0;
}

.info h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

.info p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.ops {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.op {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  display: grid;
  place-items: center;
}

.op:hover {
  background: #f1f5f9;
  color: var(--text);
}

.op.danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

.add-card {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1.5px dashed #cbd5e1;
  background: transparent;
  box-shadow: none;
  color: var(--text-secondary);
  font-size: 14px;
  min-height: 78px;
  transition: 0.15s ease;
}

.add-card:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-soft);
  transform: translateY(-2px);
}

.plus {
  font-size: 18px;
  font-weight: 700;
}

.mask {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(15, 23, 42, 0.32);
  display: grid;
  place-items: center;
}

.dialog {
  width: min(380px, 92vw);
  padding: 20px;
  border: none;
}

.dialog h3 {
  margin: 0 0 14px;
  font-size: 16px;
}

.usage {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.error {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--danger);
}

.colors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}

.color-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: 0.12s ease;
}

.color-dot.active {
  border-color: var(--text);
  transform: scale(1.12);
}

.color-dot:hover {
  transform: scale(1.1);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
