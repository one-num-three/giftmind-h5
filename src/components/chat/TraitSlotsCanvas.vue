<script setup>
/**
 * ══════════════════════════════════════════════════════════════
 *  TraitSlotsCanvas —— 12 维动态心意特质罗盘与卡槽画布
 *  展示 4 个核心基盘槽 + 8 个自适应衍生槽，具备展开/折叠与入槽高亮动效
 * ══════════════════════════════════════════════════════════════
 */
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const isExpanded = ref(false)

const traits = computed(() => session.traits12 || [])
const filledCount = computed(() => session.filledTraitsCount || 0)
const progress = computed(() => session.traitsProgress || 0)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="trait-canvas" :class="{ 'trait-canvas--expanded': isExpanded }">
    <!-- 头部栏：标题、进度与展开控制 -->
    <div class="trait-canvas__bar tap" @click="toggleExpand" role="button" tabindex="0">
      <div class="trait-canvas__left">
        <span class="trait-canvas__icon">🧭</span>
        <span class="trait-canvas__title">12维动态特质</span>
        <span class="trait-canvas__progress-badge">
          已锁定 {{ filledCount }}/12
        </span>
      </div>

      <div class="trait-canvas__right">
        <!-- 进度条 -->
        <div class="trait-canvas__track" title="画像完成度">
          <div class="trait-canvas__fill" :style="{ width: `${progress}%` }"></div>
        </div>
        <span class="trait-canvas__toggle-btn">
          {{ isExpanded ? '收起 ▲' : '卡槽详情 ▼' }}
        </span>
      </div>
    </div>

    <!-- 折叠态下的单行横滑微徽标栏 -->
    <div v-show="!isExpanded" class="trait-canvas__scroll-mini scroll-x">
      <div
        v-for="t in traits"
        :key="t.key"
        class="trait-mini-pill"
        :class="{ 'trait-mini-pill--filled': t.isFilled, 'trait-mini-pill--base': t.isBase }"
        :title="t.isFilled ? `${t.label}: ${t.value}` : `${t.label} (待探索)`"
      >
        <span class="trait-mini-pill__icon">{{ t.icon }}</span>
        <span class="trait-mini-pill__label">{{ t.label }}</span>
        <span v-if="t.isFilled" class="trait-mini-pill__check">✓</span>
      </div>
    </div>

    <!-- 展开态下的完整 12 槽网格画布 -->
    <div v-show="isExpanded" class="trait-canvas__grid anim-fade-in">
      <div
        v-for="t in traits"
        :key="t.key"
        class="trait-slot-card"
        :class="{ 'trait-slot-card--filled': t.isFilled, 'trait-slot-card--base': t.isBase }"
      >
        <div class="trait-slot-card__head">
          <div class="trait-slot-card__type">
            <span class="trait-slot-card__icon">{{ t.icon }}</span>
            <span class="trait-slot-card__label">{{ t.label }}</span>
          </div>
          <span class="trait-slot-card__tag" :class="t.isFilled ? 'tag--filled' : 'tag--pending'">
            {{ t.isFilled ? '已锁定' : '待探索' }}
          </span>
        </div>

        <div class="trait-slot-card__body">
          <div v-if="t.isFilled" class="trait-slot-card__value" :title="t.value">
            {{ t.value }}
          </div>
          <div v-else class="trait-slot-card__placeholder">
            {{ t.desc || '顺着交谈自然解锁' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trait-canvas {
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 0.25s ease;
  user-select: none;
}

.trait-canvas--expanded {
  background: #fdfdfd;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

/* 顶部交互条 */
.trait-canvas__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 6px;
  cursor: pointer;
}

.trait-canvas__left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.trait-canvas__icon {
  font-size: 14px;
}

.trait-canvas__title {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
}

.trait-canvas__progress-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  font-weight: 600;
}

.trait-canvas__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trait-canvas__track {
  width: 50px;
  height: 5px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.trait-canvas__fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #059669);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.trait-canvas__toggle-btn {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}

/* 折叠横滑栏 */
.trait-canvas__scroll-mini {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 12px 8px;
  white-space: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}
.trait-canvas__scroll-mini::-webkit-scrollbar {
  display: none;
}

.trait-mini-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.trait-mini-pill--filled {
  background: rgba(16, 185, 129, 0.08);
  color: #065f46;
  border-color: rgba(16, 185, 129, 0.25);
  font-weight: 500;
}

.trait-mini-pill__check {
  font-size: 10px;
  color: #059669;
  font-weight: bold;
}

/* 展开态网格卡片 */
.trait-canvas__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  padding: 6px 12px 12px;
  max-height: 280px;
  overflow-y: auto;
}

@media (min-width: 480px) {
  .trait-canvas__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.trait-slot-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.2s ease;
}

.trait-slot-card--filled {
  border-color: rgba(16, 185, 129, 0.35);
  background: #f0fdf4;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.08);
}

.trait-slot-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.trait-slot-card__type {
  display: flex;
  align-items: center;
  gap: 4px;
}

.trait-slot-card__icon {
  font-size: 13px;
}

.trait-slot-card__label {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
}

.trait-slot-card__tag {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1.2;
}

.tag--filled {
  background: #dcfce7;
  color: #15803d;
  font-weight: 600;
}

.tag--pending {
  background: #f1f5f9;
  color: #94a3b8;
}

.trait-slot-card__body {
  font-size: 11px;
  min-height: 20px;
  display: flex;
  align-items: center;
}

.trait-slot-card__value {
  color: #0f172a;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.3;
}

.trait-slot-card__placeholder {
  color: #94a3b8;
  font-style: italic;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.anim-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
