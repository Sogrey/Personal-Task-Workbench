<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'

const store = useWorkbenchStore()

const showForm = ref(false)

const form = reactive({
  name: '',
  description: '',
})

function submit() {
  const name = form.name.trim()
  if (!name) return
  store.addProject({ name, description: form.description })
  form.name = ''
  form.description = ''
  showForm.value = false
}

function statusBadge(status: string) {
  return status === 'archived' ? 'badge badge-neutral' : 'badge badge-success'
}

function statusText(status: string) {
  return status === 'archived' ? '已归档' : '进行中'
}
</script>

<template>
  <div class="page">
    <section class="intro card">
      <div>
        <h2>项目进度</h2>
        <p>不同项目做到哪一步、还有多少事情没完成，不用反复翻表格。进度按项目下任务完成率自动计算。</p>
      </div>
      <button class="btn btn-primary" type="button" @click="showForm = !showForm">
        {{ showForm ? '收起' : '新建项目' }}
      </button>
    </section>

    <section v-if="showForm" class="card form-card">
      <h3>新建项目</h3>
      <div class="form-grid">
        <div class="field">
          <label>项目名称</label>
          <input
            v-model="form.name"
            placeholder="比如：客户交付 A"
            @keydown.enter="submit"
          />
        </div>
        <div class="field">
          <label>项目描述（可选）</label>
          <input v-model="form.description" placeholder="一句话说明项目目标" @keydown.enter="submit" />
        </div>
      </div>
      <div class="actions">
        <button class="btn" type="button" @click="showForm = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="!form.name.trim()" @click="submit">
          保存项目
        </button>
      </div>
    </section>

    <div v-if="store.projects.length" class="grid">
      <article v-for="project in store.projects" :key="project.id" class="card project">
        <div class="head">
          <h3>
            <RouterLink
              class="p-link"
              :to="{ path: '/tasks', query: { projectId: project.id } }"
              :title="`查看「${project.name}」下的任务`"
            >
              {{ project.name }}
            </RouterLink>
          </h3>
          <span :class="statusBadge(project.status)">{{ statusText(project.status) }}</span>
        </div>
        <p>{{ project.description ?? '暂无描述' }}</p>
        <div class="metrics">
          <div>
            <span>进度</span>
            <strong>{{ store.projectProgress(project.id) }}%</strong>
          </div>
          <div>
            <span>关联任务</span>
            <strong>{{ store.tasksByProject(project.id).length }}</strong>
          </div>
          <div>
            <span>未完成</span>
            <strong>{{ store.unfinishedByProject(project.id) }}</strong>
          </div>
        </div>
        <div class="bar">
          <i :style="{ width: `${store.projectProgress(project.id)}%` }" />
        </div>
        <RouterLink class="link" :to="{ path: '/tasks', query: { projectId: project.id } }">
          查看任务 →
        </RouterLink>
      </article>
    </div>

    <section v-else class="card empty-card">
      <p class="empty-title">还没有项目</p>
      <p class="empty-hint">点击右上角「新建项目」，先建一个项目，再往里面安排任务。</p>
    </section>
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

.intro h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.intro p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.form-card {
  padding: 16px;
}

.form-card h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.project {
  padding: 18px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.head h3 {
  margin: 0;
  font-size: 16px;
}

.p-link:hover {
  text-decoration: underline;
}

.project > p {
  margin: 10px 0 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.metrics span {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
}

.metrics strong {
  font-size: 18px;
}

.bar {
  height: 10px;
  border-radius: 999px;
  background: #eef2f7;
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #66bb6a, #43a047);
}

.link {
  display: inline-block;
  margin-top: 14px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
}

.empty-card {
  padding: 40px 20px;
  text-align: center;
}

.empty-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 700;
}

@media (max-width: 900px) {
  .grid,
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
