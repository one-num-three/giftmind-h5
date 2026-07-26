<script setup>
/**
 * HistoryView —— 我的方案
 * 顶部不用 GNavBar，改成大标题 + 一行统计 + 搜索框（非常规导航，弱化「工具感」）。
 * 三种状态分得很开：一份都没有 / 搜索没结果 / 正常列表。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHistoryStore } from '@/stores/history'
import { useUiStore } from '@/stores/ui'
import { relativeTime } from '@/utils/helpers'
import PlanListItem from '@/components/gift/PlanListItem.vue'
import DemoSeeder from '@/components/layout/DemoSeeder.vue'

const router = useRouter()
const history = useHistoryStore()
const ui = useUiStore()

const menuOpen = ref(false)
const confirming = ref(false)

/* ── 顶部统计 ─────────────────────────────── */
const lastAt = computed(() => {
  const top = history.sorted[0]
  return top?.updatedAt || top?.createdAt || 0
})

const statText = computed(() => {
  if (!history.count) return '聊十分钟，就会有第一份'
  const when = relativeTime(lastAt.value)
  return when ? `共 ${history.count} 份 · 最近一次 ${when}` : `共 ${history.count} 份`
})

/* ── 搜索 ─────────────────────────────────── */
const keyword = computed({
  get: () => history.keyword,
  set: (v) => {
    history.keyword = v
  },
})
const searching = computed(() => history.keyword.trim().length > 0)

const isEmpty = computed(() => history.count === 0)
const noResult = computed(() => history.count > 0 && history.filtered.length === 0)
const noResultDesc = computed(() => {
  const kw = history.keyword.trim().slice(0, 12)
  return `「${kw}」没有匹配到方案。试试收礼人、场合，或者标题里的词。`
})

function clearKeyword() {
  history.keyword = ''
}

/* ── 更多：清空全部 ───────────────────────── */
watch(menuOpen, (v) => {
  if (!v) confirming.value = false
})

function doClear() {
  const n = history.count
  history.clearAll()
  history.keyword = ''
  menuOpen.value = false
  confirming.value = false
  ui.success(n ? `已清空 ${n} 份方案` : '已清空')
}

onMounted(() => {
  history.reload()
})
</script>

<template>
  <div class="page">
    <div class="page__body history">
      <!-- ══ 大标题区 ══ -->
      <header class="hd">
        <div class="hd__row">
          <div class="hd__text">
            <p class="hd__eyebrow">MY PLANS</p>
            <h1 class="hd__title">我的方案</h1>
            <p class="hd__stat">{{ statText }}</p>
          </div>
          <button class="hd__more tap" type="button" aria-label="更多操作" @click="menuOpen = true">
            更多
          </button>
        </div>

        <!-- 搜索 -->
        <div v-if="!isEmpty" class="search">
          <span class="search__glass" aria-hidden="true" />
          <input
            v-model="keyword"
            class="search__input"
            type="text"
            enterkeyhint="search"
            placeholder="搜标题、收礼人或场合"
            aria-label="搜索我的方案"
          />
          <button
            v-if="searching"
            class="search__clear tap"
            type="button"
            aria-label="清除搜索"
            @click="clearKeyword"
          >
            <GIcon name="close" :size="13" />
          </button>
        </div>
      </header>

      <!-- ══ 一份都没有 ══ -->
      <div v-if="isEmpty" class="state anim-up">
        <GEmpty
          emoji="🎁"
          title="还没有策划过礼物"
          desc="和 AI 聊十分钟，你会拿到送什么、说什么、怎么送出去的一整份方案。"
        >
          <GButton variant="primary" size="lg" @click="router.push('/')">
            开始第一次策划
          </GButton>
        </GEmpty>
        <DemoSeeder />
      </div>

      <!-- ══ 搜索没结果 ══ -->
      <div v-else-if="noResult" class="state anim-up">
        <GEmpty emoji="🔍" title="没有找到相关方案" :desc="noResultDesc">
          <GButton variant="outline" size="md" @click="clearKeyword">清除搜索</GButton>
        </GEmpty>
      </div>

      <!-- ══ 列表 ══ -->
      <template v-else>
        <p v-if="searching" class="list__hint">
          找到 {{ history.filtered.length }} 份相关方案
        </p>

        <TransitionGroup tag="div" name="list" class="list">
          <PlanListItem
            v-for="(p, i) in history.filtered"
            :key="p.id || `row-${i}`"
            :plan="p"
            class="list__item"
          />
        </TransitionGroup>

        <p v-if="!searching" class="list__end">左滑一行可以删除它</p>
        <DemoSeeder />
      </template>
    </div>

    <!-- ══ 更多 ══ -->
    <GSheet v-model="menuOpen" :title="confirming ? '清空全部方案？' : '管理'">
      <template v-if="confirming">
        <p class="menu__warn">
          这台设备上的 {{ history.count }} 份方案会一起消失，包括礼物推荐、写好的信和仪式流程。
        </p>
      </template>
      <template v-else>
        <button
          class="menu__item tap"
          type="button"
          :disabled="isEmpty"
          @click="confirming = true"
        >
          <span class="menu__icon"><GIcon name="trash" :size="17" /></span>
          <span class="menu__label">清空全部方案</span>
          <span class="menu__hint">{{ isEmpty ? '暂无方案' : `${history.count} 份` }}</span>
        </button>
        <p class="menu__note">方案只存在这台设备上，清空之后没办法恢复。</p>
      </template>

      <template #footer>
        <div v-if="confirming" class="menu__acts">
          <GButton variant="outline" block @click="confirming = false">再想想</GButton>
          <GButton class="btn-danger" variant="dark" block @click="doClear">确认清空</GButton>
        </div>
        <GButton v-else variant="outline" block @click="menuOpen = false">取消</GButton>
      </template>
    </GSheet>
  </div>
</template>

<style scoped>
.history {
  padding-bottom: calc(var(--tabbar-h) + 40px);
}

/* ══ 大标题区 ══════════════════════════════ */
.hd {
  padding: calc(var(--safe-top) + 28px) var(--page-x) var(--s-4);
}
.hd__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s-3);
}
.hd__text {
  flex: 1;
  min-width: 0;
}
.hd__eyebrow {
  font-family: var(--f-display);
  font-size: var(--fs-micro);
  letter-spacing: var(--ls-wider);
  color: var(--c-ink-4);
}
.hd__title {
  margin-top: 6px;
  font-family: var(--f-serif);
  font-size: 28px;
  font-weight: 500;
  line-height: 1.25;
  color: var(--c-ink);
}
.hd__stat {
  margin-top: var(--s-2);
  font-size: var(--fs-caption);
  color: var(--c-ink-3);
}
.hd__more {
  position: relative;
  flex-shrink: 0;
  min-width: 56px;
  height: 34px;
  margin-top: 18px;
  padding: 0 14px;
  border-radius: var(--r-pill);
  background: var(--c-paper-2);
  color: var(--c-ink-2);
  font-size: var(--fs-caption);
}
/* 视觉上是个小胶囊，可点区域补足到 44×44 */
.hd__more::before {
  content: '';
  position: absolute;
  top: -5px;
  right: -4px;
  bottom: -5px;
  left: -4px;
}

/* ══ 搜索框 ════════════════════════════════ */
.search {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  height: 40px;
  margin-top: var(--s-5);
  padding: 0 var(--s-3);
  border-radius: var(--r-pill);
  background: var(--c-paper-2);
  transition: box-shadow var(--t-fast) var(--e-out);
}
.search:focus-within {
  box-shadow: inset 0 0 0 1px var(--c-rose-soft);
}
/* 放大镜：图标集里没有现成的，用两个盒子拼一个，颜色跟随 currentColor */
.search__glass {
  position: relative;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  margin-left: 2px;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  color: var(--c-ink-4);
}
.search__glass::after {
  content: '';
  position: absolute;
  right: -4px;
  bottom: 1px;
  width: 6px;
  height: 1.5px;
  border-radius: 1px;
  background: currentColor;
  transform: rotate(45deg);
  transform-origin: left center;
}
.search__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  font-family: var(--f-sans);
  font-size: var(--fs-sm);
  color: var(--c-ink);
}
.search__input::placeholder {
  color: var(--c-ink-4);
}
.search__clear {
  position: relative;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--c-ink-4);
  color: var(--c-paper);
}
/* 同上：图标 22px，热区补高到 44px（左侧少扩一点，别抢输入框的点击） */
.search__clear::before {
  content: '';
  position: absolute;
  top: -11px;
  right: -10px;
  bottom: -11px;
  left: -6px;
}

/* ══ 状态 ══════════════════════════════════ */
.state {
  padding-top: var(--s-4);
}

/* ══ 列表 ══════════════════════════════════ */
.list {
  position: relative;
  padding: var(--s-2) var(--page-x) 0;
}
.list__item {
  margin-bottom: var(--s-3);
}
.list__hint {
  padding: 0 var(--page-x);
  font-size: var(--fs-micro);
  color: var(--c-ink-3);
}
.list__end {
  padding-top: var(--s-3);
  text-align: center;
  font-size: var(--fs-micro);
  color: var(--c-ink-4);
}

.list-move {
  transition: transform var(--t-base) var(--e-out);
}
.list-enter-active,
.list-leave-active {
  transition: opacity var(--t-base) var(--e-out), transform var(--t-base) var(--e-out);
}
.list-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.list-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
/* 离场时脱离文档流，后面的行才会顺滑地补位 */
.list-leave-active {
  position: absolute;
  left: var(--page-x);
  right: var(--page-x);
}

/* ══ 更多面板 ══════════════════════════════ */
.menu__item {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  width: 100%;
  height: 52px;
  padding: 0 var(--s-4);
  border-radius: var(--r-md);
  background: var(--c-surface);
  box-shadow: inset 0 0 0 1px var(--c-line);
  color: var(--c-danger);
  text-align: left;
}
.menu__item:disabled {
  opacity: 0.45;
  pointer-events: none;
}
.menu__icon {
  display: flex;
  flex-shrink: 0;
}
.menu__label {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-body);
}
.menu__hint {
  flex-shrink: 0;
  font-size: var(--fs-caption);
  color: var(--c-ink-4);
}
.menu__note,
.menu__warn {
  margin-top: var(--s-3);
  font-size: var(--fs-sm);
  line-height: var(--lh-normal);
  color: var(--c-ink-3);
}
.menu__warn {
  margin-top: 0;
}
.menu__acts {
  display: flex;
  gap: var(--s-3);
}
.menu__acts > * {
  flex: 1;
  min-width: 0;
}
.menu__acts :deep(.btn-danger) {
  background: var(--c-danger);
  color: var(--c-ink-inverse);
  box-shadow: none;
}
</style>
