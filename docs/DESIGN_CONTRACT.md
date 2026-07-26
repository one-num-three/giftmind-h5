# GiftMind H5 · 开发契约（所有页面必须遵守）

> 这份文件是并行开发的唯一事实来源。写任何页面前先读完它。

## 1. 技术栈与约定

- Vue 3.5 `<script setup>` + Vite 7 + vue-router 4（**hash 模式**）+ Pinia 3
- 别名 `@` → `src`
- **CSS 全部写在 SFC 的 `<style scoped>` 里**，用 `src/styles/tokens.css` 的 CSS 变量，**禁止写死颜色/字号/圆角**
- 单位直接写设计稿 px（设计稿宽 375），构建时由 `postcss-pxtorem` 自动转 rem，**不要自己写 rem/vw**
  - 例外：`1px` 描边不会被转换（`minPixelValue: 2`），可放心使用
- 不引入任何新的 npm 依赖（包括 UI 库、动画库、图标库）
- 中文文案，语气克制真诚，**不要过度使用感叹号和排比**

## 2. 视觉风格：明亮温柔

奶油白底 + 莫兰迪色系 + 圆润卡片 + 暖调低对比阴影。参考关键 token：

| 用途 | 变量 |
| --- | --- |
| 页面底 / 卡片 | `--c-paper` `--c-paper-2` `--c-surface` |
| 文字 4 级 | `--c-ink` `--c-ink-2` `--c-ink-3` `--c-ink-4` |
| 品牌主色（玫瑰陶土） | `--c-rose` `--c-rose-deep` `--c-rose-soft` `--c-rose-tint` |
| 辅助色 | `--c-sage`(绿) `--c-lilac`(灰紫) `--c-sand`(沙杏) `--c-sky`(雾蓝) 各带 `-soft` `-deep` |
| 渐变 | `--g-warm` `--g-primary` `--g-dawn` `--g-dusk` |
| 圆角 | `--r-sm/md/lg/xl/pill` |
| 阴影 | `--sh-1/2/3` `--sh-primary` |
| 间距 | `--s-1`(4) … `--s-10`(72)，页面左右边距 `--page-x` |
| 字体 | `--f-sans`(UI) `--f-serif`(中文情绪) `--f-display`(拉丁大标题) |
| 动效 | `--t-fast/base/slow` + `--e-out/-in-out/-spring` |

排版原则：**中文情绪文案用 `--f-serif`，UI 用 `--f-sans`**。大标题可混排 `--f-display` 的拉丁斜体。

`global.css` 已提供工具类：`.page` `.page__body` `.page-x` `.scroll-y` `.row/.col/.between/.center/.gap-N`
`.t-display/.t-h1/.t-h2/.t-h3/.t-body/.t-sm/.t-caption/.t-eyebrow` `.section-label` `.anim-up` `.d-1…d-6` `.tap` `.grain` `.glow` `.safe-bottom`
动画关键帧：`fadeUp` `fadeIn` `floaty` `shimmer` `breathe`

## 3. 已全局注册的基础组件（直接用，不用 import）

```
<GButton variant="primary|soft|outline|ghost|dark" size="sm|md|lg" block round loading disabled>
<GCard padding="none|sm|md|lg" tone="surface|paper|rose|sage|lilac|sand|sky" radius="sm|md|lg|xl" elevated bordered>
<GChip selected disabled emoji hint tone="default|rose|sage|lilac|sand|sky" size="sm|md">
<GIcon name="..." :size="20" />
<GNavBar title subtitle :back="true" transparent :to="路由" >  # 具名插槽 #right
<GProgress :value="0-100" :height="3" />
<GSheet v-model="open" title>   # 具名插槽 #header #footer
<GSkeleton width height radius :rows="n" />
<GEmpty emoji title desc>  # 默认插槽放按钮
```

GIcon 可用名称：
`back chevron chevronDown close send heart share copy refresh check plus sparkle gift trash edit home bookmark arrowRight clock lock mail skip eye`

## 4. 页面骨架标准写法

```vue
<template>
  <div class="page">
    <GNavBar title="标题" />
    <div class="page__body">
      <!-- 内容，左右用 .page-x 或自己的 padding -->
    </div>
    <!-- 需要底部固定操作条时放这里 -->
  </div>
</template>
```

底部 TabBar 由 `App.vue` 根据 `route.meta.tab` 自动渲染，**页面不要自己写 TabBar**。
有 TabBar 的页面（landing / history），内容底部要留 `padding-bottom: calc(var(--tabbar-h) + var(--s-6))`。

## 5. Store API

```js
import { useSessionStore } from '@/stores/session'
// state: id, messages[], answers{}, stepIndex, status
// getters: steps, currentStep, isFinished, progress, stageText, answeredCount
// actions: start(fresh), pushMessage({role:'ai'|'user', text, muted?}), answer(step, value, displayText),
//          skip(step), back(), reset(), persistDraft(), restoreDraft(), hasDraft()

import { usePlanStore } from '@/stores/plan'
// state: current, generating, progressStage, error, likedGiftIds
// getters: hasPlan, gifts, letter, ritual
// actions: generate(answers), shuffleGifts(), regenerateLetter(tone), toggleLike(id), setCurrent(plan), clear()

import { useHistoryStore } from '@/stores/history'
// state: plans, keyword | getters: sorted, filtered, count
// actions: save(plan), remove(id), get(id), reload(), clearAll()

import { useUiStore } from '@/stores/ui'
// actions: showToast(text,type), success(text), error(text), setLoading(v,text)
```

## 6. 数据结构（Plan）

```ts
Plan = {
  id, createdAt, updatedAt,
  answers: { recipient, occasion, timing, budget, personality[], taboo[], memory, relationshipNote, feeling, style[] },
  title: string,            // 12 字内
  subtitle: string,
  insight: { summary: string, traits: string[], keyPoint: string },
  gifts: Array<{
    id, emoji, name, why, price, category: '实物'|'体验'|'定制'|'数字'|'组合',
    tags: string[], matchScore: number /*0-100*/, tip: string, leadTime: string
  }>,
  letter: { salutation, paragraphs: string[], signature, tone },
  ritual: Array<{ time, title, desc }>,
  share: { greeting, coverEmoji, theme: 'dawn'|'dusk'|'sage' }
}
```

## 7. 路由表

| name | path | 说明 |
| --- | --- | --- |
| landing | `/` | 首页，有 TabBar |
| chat | `/chat` | AI 对话问卷 |
| generating | `/generating` | 生成中过场 |
| plan | `/plan/:id?` | 方案结果页（无 id 用 planStore.current） |
| share-edit | `/share/edit/:id` | 送出前配置分享页 |
| share | `/s/:shareId` | 收礼人打开的页面（独立视觉） |
| history | `/history` | 我的方案，有 TabBar |

## 8. 通用工具

```js
import { uid, sleep, formatDate, relativeTime, toArray, joinText, copyText, seededRandom, pickN, parseBudget } from '@/utils/helpers'
import api from '@/api'   // generatePlan / chatOnce / regenerateLetter / shuffleGifts / createShare / fetchShare
```

## 9. 质量红线

- 必须能在 375×812 与 430×932 两种宽度下正常显示，不出现横向滚动
- 所有可点区域最小 44×44，加 `.tap` 类做按压反馈
- 长文本要有省略或换行处理，空态要有 `<GEmpty>`
- 不使用 `localStorage` 之外的浏览器存储；不使用 `alert/confirm/prompt`
- 组件内不要出现 `console.log`
