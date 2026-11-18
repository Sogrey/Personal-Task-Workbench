<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'
import type { Task } from '@/types'
import { statusBadgeClass } from '@/utils/status'
import ClosedLoopWizard from '@/components/common/ClosedLoopWizard.vue'
import {
  addDays,
  buildDailyReport,
  buildMonthlyReport,
  buildWeeklyReport,
  closedLoopChecks,
  completedDayOf,
  dailyToMarkdown,
  monthlyToMarkdown,
  startOfWeekIso,
  weeklyToMarkdown,
} from '@/utils/report'

type Tab = 'daily' | 'weekly' | 'monthly'

const store = useWorkbenchStore()
const tab = ref<Tab>('daily')

const todayStr = computed(() => store.today)
const dailyDate = ref(store.today)
const weekStart = ref(startOfWeekIso(store.today))
const month = ref(todayStr.value.slice(0, 7))

const input = computed(() => ({
  tasks: store.tasks,
  projects: store.projects,
  tags: store.tags,
  history: store.history,
  today: store.today,
}))

function projectName(id?: string) {
  return store.projectById(id)?.name ?? '未关联项目'
}
function tagName(id: string) {
  return store.tags.find((t) => t.id === id)?.name
}

const daily = computed(() => buildDailyReport(input.value, dailyDate.value))
const weekly = computed(() => buildWeeklyReport(input.value, weekStart.value))
const monthly = computed(() => buildMonthlyReport(input.value, month.value))

const totalPlannedHours = computed(() =>
  Math.round(weekly.value.timeByProject.reduce((s, x) => s + x.hours, 0) * 10) / 10,
)
const maxTrend = computed(() => Math.max(1, ...monthly.value.weeklyTrend.map((w) => w.completed)))

const markdown = computed(() => {
  const owner = store.prefs.ownerName
  if (tab.value === 'daily') return dailyToMarkdown(daily.value, owner, projectName, tagName, store.history)
  if (tab.value === 'weekly') return weeklyToMarkdown(weekly.value, owner, projectName, todayStr.value, store.history)
  return monthlyToMarkdown(monthly.value, owner, projectName)
})

/** ───── 闭环检查（报告生成前的状态一致性）───── */
const closedItems = computed(() => closedLoopChecks(input.value))
const mustItems = computed(() => closedItems.value.filter((i) => i.group === 'must'))
const optionalItems = computed(() => closedItems.value.filter((i) => i.group === 'optional'))

const wizardOpen = ref(false)
const wizardMode = ref<'must' | 'optional'>('must')
const hasAutoOpened = ref(false)

/** 进入报告页：存在待闭环项自动弹向导（每次会话一次），手动按钮常驻 */
onMounted(() => {
  if (mustItems.value.length) {
    wizardOpen.value = true
    wizardMode.value = 'must'
    hasAutoOpened.value = true
  }
})

function openWizard(mode: 'must' | 'optional') {
  wizardMode.value = mode
  wizardOpen.value = true
}

/** 展示模式：structure 卡片视图 / markdown 预览 */
const view = ref<'structure' | 'markdown'>('structure')

const copied = ref(false)
async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(markdown.value)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 2000)
  } catch {
    // 剪贴板不可用时切到 Markdown 预览手动复制
    view.value = 'markdown'
  }
}

/** BK-3：导出当前报表为 .md 文件（文件名含报表类型与期间） */
const exportFilename = computed(() => {
  if (tab.value === 'daily') return `工作日报-${dailyDate.value}.md`
  if (tab.value === 'weekly') return `工作周报-${weekly.value.weekStart}_${weekly.value.weekEnd}.md`
  return `工作月报-${month.value}.md`
})

function exportMarkdown() {
  const blob = new Blob([markdown.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = exportFilename.value
  a.click()
  URL.revokeObjectURL(url)
}

function shiftDaily(n: number) {
  dailyDate.value = addDays(dailyDate.value, n)
}
function goTodayDaily() {
  dailyDate.value = todayStr.value
}
function shiftWeek(n: number) {
  weekStart.value = addDays(weekStart.value, n * 7)
}
function goThisWeek() {
  weekStart.value = startOfWeekIso(todayStr.value)
}
function shiftMonth(n: number) {
  const [y, m] = month.value.split('-').map(Number)
  const d = new Date(y ?? 0, (m ?? 1) - 1 + n, 1)
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function goThisMonth() {
  month.value = todayStr.value.slice(0, 7)
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'daily', label: '日报' },
  { key: 'weekly', label: '周报' },
  { key: 'monthly', label: '月报' },
]

function deadlineOf(t: Task) {
  return (t.deadline ?? t.endAt).slice(0, 10)
}
</script>

<template>
  <div class="page">
    <section class="intro card">
      <div class="intro-main">
        <h2>工作报告</h2>
        <p>
          基于任务与历史留痕自动汇总：完成/新增/逾期计数来自变更记录，时间投入为计划口径。
          可一键复制 Markdown，粘贴到工作日报表格或文档归档。
        </p>
      </div>
      <div class="intro-tools">
        <div class="tabs">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            class="tab"
            :class="{ on: tab === t.key }"
            @click="tab = t.key"
          >
            {{ t.label }}
          </button>
        </div>
        <div class="nav-tools">
          <!-- 期间导航 -->
          <template v-if="tab === 'daily'">
            <button class="btn btn-ghost" type="button" @click="shiftDaily(-1)">‹</button>
            <input v-model="dailyDate" type="date" title="报告日期" />
            <button class="btn btn-ghost" type="button" @click="shiftDaily(1)">›</button>
            <button class="btn" type="button" @click="goTodayDaily">今天</button>
          </template>
          <template v-else-if="tab === 'weekly'">
            <button class="btn btn-ghost" type="button" @click="shiftWeek(-1)">‹</button>
            <span class="range">{{ weekly.label }}</span>
            <button class="btn btn-ghost" type="button" @click="shiftWeek(1)">›</button>
            <button class="btn" type="button" @click="goThisWeek">本周</button>
          </template>
          <template v-else>
            <button class="btn btn-ghost" type="button" @click="shiftMonth(-1)">‹</button>
            <span class="range">{{ monthly.label }}</span>
            <button class="btn btn-ghost" type="button" @click="shiftMonth(1)">›</button>
            <button class="btn" type="button" @click="goThisMonth">本月</button>
          </template>
          <span class="view-switch">
            <button
              type="button"
              class="tab"
              :class="{ on: view === 'structure' }"
              title="结构化视图"
              @click="view = 'structure'"
            >视图</button>
            <button
              type="button"
              class="tab"
              :class="{ on: view === 'markdown' }"
              title="Markdown 源码"
              @click="view = 'markdown'"
            >Markdown</button>
          </span>
          <button class="btn btn-primary" type="button" @click="copyMarkdown">
            {{ copied ? '已复制 ✓' : '复制 Markdown' }}
          </button>
          <button class="btn" type="button" title="下载当前报表 Markdown 文件" @click="exportMarkdown">导出 .md</button>
        </div>
      </div>
    </section>

    <!-- 闭环检查横幅：待闭环必答 + 进行中可选采集 -->
    <section v-if="mustItems.length || optionalItems.length" class="closedloop-banner card">
      <div class="cl-text">
        <strong v-if="mustItems.length">⚠ 发现 {{ mustItems.length }} 项待闭环任务</strong>
        <strong v-else>进行中进展采集（可选）</strong>
        <span>{{
          mustItems.length
            ? '计划时间与任务状态不一致，建议先确认再生成报告，数据实时反映确认结果'
            : `${optionalItems.length} 项进行中任务可补充进展说明或确认完成`
        }}</span>
      </div>
      <div class="cl-actions">
        <button v-if="mustItems.length" class="btn btn-primary" type="button" @click="openWizard('must')">
          开始闭环
        </button>
        <button
          v-if="optionalItems.length"
          class="btn"
          :class="{ 'btn-primary': !mustItems.length }"
          type="button"
          @click="openWizard('optional')"
        >
          采集进展
        </button>
      </div>
    </section>

    <!-- ══════════ Markdown 预览 ══════════ -->
    <section v-if="view === 'markdown'" class="card md-card">
      <pre>{{ markdown }}</pre>
    </section>

    <!-- ══════════ 日报 ══════════ -->
    <template v-else-if="tab === 'daily'">
      <section class="card sec">
        <div class="card-title">
          <span>今日完成（{{ daily.completed.length }} 项）</span>
          <span class="muted">{{ daily.date }} {{ daily.weekday }}</span>
        </div>
        <ul v-if="daily.completed.length" class="task-list">
          <li v-for="t in daily.completed" :key="t.id">
            <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: t.id } }">{{ t.title }}</RouterLink>
            <span class="meta">{{ projectName(t.projectId) }}</span>
            <span :class="statusBadgeClass(t.status)">{{ t.status === 'done' ? '已完成' : '完成后又变更' }}</span>
          </li>
        </ul>
        <div v-else class="empty-hint">当天没有完成动作（含当天完成又重开的任务）</div>
      </section>

      <div class="grid-2">
        <section class="card sec">
          <div class="card-title"><span>进行中（{{ daily.inProgress.length }} 项）</span></div>
          <ul v-if="daily.inProgress.length" class="task-list">
            <li v-for="t in daily.inProgress" :key="t.id">
              <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: t.id } }">{{ t.title }}</RouterLink>
              <span class="meta">{{ projectName(t.projectId) }}</span>
              <span v-if="store.latestProgressNote(t.id)" class="note-tip">{{ store.latestProgressNote(t.id) }}</span>
            </li>
          </ul>
          <div v-else class="empty-hint">暂无进行中任务</div>
        </section>
        <section class="card sec">
          <div class="card-title"><span>今日新增（{{ daily.created.length }} 项）</span></div>
          <ul v-if="daily.created.length" class="task-list">
            <li v-for="t in daily.created" :key="t.id">
              <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: t.id } }">{{ t.title }}</RouterLink>
            </li>
          </ul>
          <div v-else class="empty-hint">当天未新建任务</div>
        </section>
      </div>

      <div class="grid-2">
        <section class="card sec">
          <div class="card-title">
            <span>明日排期（{{ daily.tomorrow.length }} 项）</span>
            <span class="muted">{{ addDays(daily.date, 1) }}</span>
          </div>
          <ul v-if="daily.tomorrow.length" class="task-list">
            <li v-for="t in daily.tomorrow" :key="t.id">
              <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: t.id } }">{{ t.title }}</RouterLink>
              <template v-if="t.status === 'done'">
                <span class="done-tag">✓ 已提前完成（实际 {{ completedDayOf(t, store.history) ?? '—' }}）</span>
              </template>
              <span v-else class="meta">截止 {{ deadlineOf(t) }}</span>
            </li>
          </ul>
          <div v-else class="empty-hint">明天暂无排期</div>
        </section>
        <section class="card sec" :class="{ warn: daily.overdue.length }">
          <div class="card-title">
            <span>{{ daily.overdue.length ? '⚠ 逾期未完成' : '逾期未完成' }}（{{ daily.overdue.length }} 项）</span>
          </div>
          <ul v-if="daily.overdue.length" class="task-list overdue">
            <li v-for="t in daily.overdue" :key="t.id">
              <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: t.id } }">{{ t.title }}</RouterLink>
              <span class="meta">截止 {{ deadlineOf(t) }}</span>
            </li>
          </ul>
          <div v-else class="empty-hint">无逾期任务</div>
        </section>
      </div>

      <section class="card sec">
        <div class="card-title"><span>调整记录（{{ daily.adjustments.length }} 条）</span></div>
        <div v-if="daily.adjustments.length" class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>时间</th><th>任务</th><th>调整内容</th><th>原值</th><th>新值</th></tr>
            </thead>
            <tbody>
              <tr v-for="rec in daily.adjustments" :key="rec.id">
                <td>{{ rec.time.slice(11) }}</td>
                <td>
                  <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: rec.taskId } }">{{ rec.taskTitle }}</RouterLink>
                </td>
                <td>{{ rec.field }}</td>
                <td>{{ rec.oldValue }}</td>
                <td>{{ rec.newValue }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-hint">当天没有任务调整</div>
      </section>
    </template>

    <!-- ══════════ 周报 ══════════ -->
    <template v-else-if="tab === 'weekly'">
      <section class="card sec">
        <div class="card-title"><span>本周概览 · {{ weekly.label }}</span></div>
        <div class="kpi-row">
          <div class="kpi"><span>完成任务</span><strong>{{ weekly.completed.length }}</strong></div>
          <div class="kpi"><span>进行中</span><strong>{{ weekly.inProgress.length }}</strong></div>
          <div class="kpi"><span>新建任务</span><strong>{{ weekly.created.length }}</strong></div>
          <div class="kpi" :class="{ bad: weekly.riskOverdue.length }"><span>逾期未完成</span><strong>{{ weekly.riskOverdue.length }}</strong></div>
          <div class="kpi" :class="{ bad: weekly.riskDelayed.length }"><span>已确认延期</span><strong>{{ weekly.riskDelayed.length }}</strong></div>
        </div>
      </section>

      <section class="card sec">
        <div class="card-title"><span>完成明细（{{ weekly.completed.length }} 项）</span></div>
        <ul v-if="weekly.completed.length" class="task-list">
          <li v-for="t in weekly.completed" :key="t.id">
            <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: t.id } }">{{ t.title }}</RouterLink>
            <span class="meta">{{ projectName(t.projectId) }}</span>
          </li>
        </ul>
        <div v-else class="empty-hint">本周无完成任务</div>
      </section>

      <div class="grid-2">
        <section v-if="weekly.projectStats.length" class="card sec">
          <div class="card-title"><span>项目进展</span></div>
          <div class="proj-rows">
            <div v-for="p in weekly.projectStats" :key="p.id" class="proj">
              <div class="proj-head">
                <strong>{{ p.name }}</strong>
                <span class="muted">{{ p.done }}/{{ p.total }} · {{ p.progress }}%</span>
              </div>
              <div class="bar"><i :style="{ width: `${p.progress}%` }" /></div>
            </div>
          </div>
        </section>
        <section v-if="weekly.timeByProject.length" class="card sec">
          <div class="card-title">
            <span>时间投入（计划口径）</span>
            <span class="muted">合计 {{ totalPlannedHours }}h</span>
          </div>
          <div class="proj-rows">
            <div v-for="x in weekly.timeByProject" :key="x.name" class="proj">
              <div class="proj-head">
                <strong>{{ x.name }}</strong>
                <span class="muted">{{ x.hours }}h</span>
              </div>
              <div class="bar time"><i :style="{ width: `${totalPlannedHours ? (x.hours / totalPlannedHours) * 100 : 0}%` }" /></div>
            </div>
          </div>
        </section>
      </div>

      <!-- 进行中与进展（B2 采集结果展示） -->
      <section v-if="weekly.inProgress.length" class="card sec">
        <div class="card-title"><span>进行中与进展（{{ weekly.inProgress.length }} 项）</span></div>
        <ul class="task-list">
          <li v-for="item in weekly.inProgress" :key="item.task.id" class="prog-item">
            <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: item.task.id } }">{{ item.task.title }}</RouterLink>
            <span class="meta">{{ projectName(item.task.projectId) }}</span>
            <span class="note-tip">{{ item.note ?? '暂无进展说明' }}</span>
          </li>
        </ul>
      </section>

      <div class="grid-2">
        <section class="card sec" :class="{ warn: weekly.riskOverdue.length || weekly.riskHighPriority.length || weekly.riskDelayed.length }">
          <div class="card-title">
            <span>{{ weekly.riskOverdue.length || weekly.riskHighPriority.length || weekly.riskDelayed.length ? '⚠ 未完成与风险' : '未完成与风险' }}</span>
          </div>
          <template v-if="weekly.riskOverdue.length || weekly.riskHighPriority.length || weekly.riskDelayed.length">
            <div v-if="weekly.riskOverdue.length" class="risk-group">
              <h4>逾期（{{ weekly.riskOverdue.length }} 项）</h4>
              <ul class="task-list overdue">
                <li v-for="t in weekly.riskOverdue" :key="t.id">
                  <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: t.id } }">{{ t.title }}</RouterLink>
                  <span class="meta">截止 {{ deadlineOf(t) }}</span>
                </li>
              </ul>
            </div>
            <div v-if="weekly.riskDelayed.length" class="risk-group">
              <h4>已确认延期（{{ weekly.riskDelayed.length }} 项）</h4>
              <ul class="task-list overdue">
                <li v-for="t in weekly.riskDelayed" :key="t.id">
                  <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: t.id } }">{{ t.title }}</RouterLink>
                  <span class="meta">{{ t.delayNote || '未按计划开始' }}</span>
                </li>
              </ul>
            </div>
            <div v-if="weekly.riskHighPriority.length" class="risk-group">
              <h4>高优先级未完成（{{ weekly.riskHighPriority.length }} 项）</h4>
              <ul class="task-list">
                <li v-for="t in weekly.riskHighPriority" :key="t.id">
                  <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: t.id } }">{{ t.title }}</RouterLink>
                  <span class="meta">{{ t.priority === 'urgent' ? '紧急' : '高' }}</span>
                </li>
              </ul>
            </div>
          </template>
          <div v-else class="empty-hint">无逾期、延期与高优先级未完成事项</div>
        </section>
        <section class="card sec">
          <div class="card-title"><span>下周排期（{{ weekly.nextWeek.length }} 项）</span></div>
          <ul v-if="weekly.nextWeek.length" class="task-list">
            <li v-for="t in weekly.nextWeek" :key="t.id">
              <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: t.id } }">{{ t.title }}</RouterLink>
              <template v-if="t.status === 'done'">
                <span class="done-tag">✓ 已提前完成（实际 {{ completedDayOf(t, store.history) ?? '—' }}）</span>
              </template>
              <span v-else class="meta">{{ t.startAt.slice(5, 10).replace('-', '/') }} 开始</span>
            </li>
          </ul>
          <div v-else class="empty-hint">下周暂无排期，可提前安排</div>
        </section>
      </div>
    </template>

    <!-- ══════════ 月报 ══════════ -->
    <template v-else>
      <section class="card sec">
        <div class="card-title"><span>{{ monthly.label }} · {{ monthly.monthlyRange }}</span></div>
        <div class="kpi-row">
          <div class="kpi"><span>完成任务</span><strong>{{ monthly.completedCount }}</strong></div>
          <div class="kpi"><span>新建任务</span><strong>{{ monthly.createdCount }}</strong></div>
          <div class="kpi" :class="{ bad: monthly.overdueCount }"><span>截至月末逾期</span><strong>{{ monthly.overdueCount }}</strong></div>
        </div>
        <p class="timeliness">
          完成时效：提前 {{ monthly.timeliness.early }} 项 · 按时 {{ monthly.timeliness.ontime }} 项 · 超时 {{ monthly.timeliness.late }} 项
        </p>
      </section>

      <div class="grid-2">
        <section class="card sec">
          <div class="card-title"><span>周完成趋势</span></div>
          <div class="trend">
            <div v-for="w in monthly.weeklyTrend" :key="w.label" class="trend-col">
              <span class="trend-num">{{ w.completed }}</span>
              <div class="trend-bar"><i :style="{ height: `${(w.completed / maxTrend) * 100}%` }" /></div>
              <span class="trend-label">{{ w.label }}</span>
            </div>
          </div>
        </section>
        <section v-if="monthly.tagDist.length" class="card sec">
          <div class="card-title"><span>完成任务标签分布</span></div>
          <div class="tag-dist">
            <span v-for="t in monthly.tagDist" :key="t.name" class="dist-chip">
              {{ t.name }} <strong>{{ t.count }}</strong>
            </span>
          </div>
        </section>
      </div>

      <section v-if="monthly.projectStats.length" class="card sec">
        <div class="card-title"><span>项目进展（截至当前）</span></div>
        <div class="proj-rows grid-3">
          <div v-for="p in monthly.projectStats" :key="p.id" class="proj">
            <div class="proj-head">
              <strong>{{ p.name }}</strong>
              <span class="muted">{{ p.done }}/{{ p.total }} · {{ p.progress }}%</span>
            </div>
            <div class="bar"><i :style="{ width: `${p.progress}%` }" /></div>
          </div>
        </div>
      </section>

      <section class="card sec">
        <div class="card-title"><span>完成明细（{{ monthly.completed.length }} 项）</span></div>
        <ul v-if="monthly.completed.length" class="task-list dense">
          <li v-for="t in monthly.completed" :key="t.id">
            <RouterLink class="text-link" :to="{ path: '/tasks', query: { task: t.id } }">{{ t.title }}</RouterLink>
            <span class="meta">{{ projectName(t.projectId) }}</span>
          </li>
        </ul>
        <div v-else class="empty-hint">本月暂无完成任务</div>
      </section>
    </template>

    <!-- 闭环向导：待闭环（must）与可选进展采集（optional）两种模式 -->
    <ClosedLoopWizard
      v-if="wizardOpen && (wizardMode === 'must' ? mustItems.length : optionalItems.length)"
      :key="wizardMode"
      :items="wizardMode === 'must' ? mustItems : optionalItems"
      :mode="wizardMode"
      :today="todayStr"
      @close="wizardOpen = false"
      @done="wizardOpen = false"
    />
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
  flex-direction: column;
  gap: 14px;
}

.intro h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.intro p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  max-width: 860px;
  line-height: 1.6;
}

.intro-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tabs,
.view-switch {
  display: inline-flex;
  background: #eef2f7;
  border-radius: 10px;
  padding: 3px;
}

.tab {
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.tab.on {
  background: #fff;
  color: var(--text);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
}

.nav-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.nav-tools input[type='date'] {
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 8px;
  background: #fff;
  font-size: 13px;
}

.range {
  font-size: 13px;
  font-weight: 600;
  min-width: 118px;
  text-align: center;
}

.sec {
  padding: 16px 18px;
}

.sec.warn .card-title span:first-child {
  color: #b45309;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  flex-wrap: wrap;
}

.task-list li > a {
  font-weight: 600;
}

.task-list .meta {
  color: var(--text-secondary);
  font-size: 12px;
}

.task-list.dense {
  max-height: 320px;
  overflow: auto;
}

.overdue .meta {
  color: #b91c1c;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.kpi {
  padding: 14px;
  border-radius: 10px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi span {
  font-size: 12px;
  color: var(--text-secondary);
}

.kpi strong {
  font-size: 22px;
}

.kpi.bad {
  background: var(--danger-soft);
}

.kpi.bad strong {
  color: #b91c1c;
}

.proj-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.proj .proj-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.proj .proj-head .muted {
  font-size: 12px;
  color: var(--text-secondary);
}

.bar {
  height: 8px;
  border-radius: 999px;
  background: #eef2f7;
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #66bb6a, #43a047);
  border-radius: inherit;
}

.bar.time i {
  background: linear-gradient(90deg, #60a5fa, #3b82f6);
}

.risk-group h4 {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--text);
}

.risk-group + .risk-group {
  margin-top: 12px;
}

.trend {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 8px 4px 0;
  min-height: 170px;
}

.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
}

.trend-num {
  font-size: 13px;
  font-weight: 700;
}

.trend-bar {
  width: 100%;
  max-width: 52px;
  flex: 1;
  background: #eef2f7;
  border-radius: 8px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  min-height: 60px;
}

.trend-bar i {
  display: block;
  width: 100%;
  background: linear-gradient(180deg, #66bb6a, #43a047);
  border-radius: 0 0 8px 8px;
}

.trend-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.tag-dist {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dist-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--info-soft);
  color: #1d4ed8;
  font-size: 12.5px;
}

.closedloop-banner {
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  border-left: 4px solid var(--warning);
}

.cl-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cl-text strong {
  font-size: 14px;
  color: #b45309;
}

.cl-text span {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.cl-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.note-tip {
  font-size: 12px;
  color: var(--text-secondary);
  background: #f1f5f9;
  border-radius: 6px;
  padding: 2px 8px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.done-tag {
  font-size: 12px;
  color: #047857;
  background: var(--success-soft);
  border-radius: 6px;
  padding: 2px 8px;
  white-space: nowrap;
}

.timeliness {
  margin: 10px 0 0;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.prog-item {
  align-items: flex-start;
}

.prog-item .note-tip {
  flex-basis: 100%;
  white-space: normal;
}

.md-card {
  padding: 16px 18px;
}

.md-card pre {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
  max-height: 640px;
  overflow: auto;
}

@media (max-width: 1100px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }

  .grid-3 {
    grid-template-columns: 1fr 1fr;
  }
}
</style>