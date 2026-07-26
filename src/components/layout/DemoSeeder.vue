<script setup>
/**
 * DemoSeeder —— 演示数据填充（仅开发环境渲染）
 *
 * 给投资人 demo / 设计走查用：一键塞几份不同类型的方案，
 * 让列表的封面主题、预算、件数、相对时间都有层次，不用真的聊三遍。
 * 走的是和真实流程同一个 mock 引擎（generateMockPlan），数据结构完全一致。
 */
import { computed, ref } from 'vue'
import { generateMockPlan } from '../../../mock/planGenerator'
import { useHistoryStore } from '@/stores/history'
import { useUiStore } from '@/stores/ui'
import { uid } from '@/utils/helpers'

const isDev = Boolean(import.meta.env.DEV)

const history = useHistoryStore()
const ui = useUiStore()

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/**
 * 三份互不相同的问卷：收礼人 / 场合 / 预算 / 形式都岔开，
 * 生成出来的标题、封面 emoji、主题色才会有区别。
 * 取值必须和 config/flow.js 的选项字面量一致，否则命中不了内容库。
 * ago 决定 updatedAt 与「几天前」的层次；memories 让重复点击不会造出三条一样的。
 */
const DEMOS = [
  {
    ago: 3 * HOUR,
    memories: [
      '她最近总念叨想学花艺，上次路过花店在门口站了很久。',
      '她说想找个周末去看海，说完自己又笑说太麻烦了。',
      '她一直留着我们第一次看的那场电影的票根。',
    ],
    answers: {
      recipient: '女朋友 / 妻子',
      occasion: '生日',
      timing: '一周内',
      budget: '¥300–600',
      personality: ['文艺 / 小众', '温柔 / 居家'],
      taboo: ['不要太张扬、怕尴尬'],
      relationshipNote: '稳定期，想制造一点新鲜感',
      feeling: '被深深理解，感动到想哭',
      style: ['实物礼物', '定制 / 手工'],
    },
  },
  {
    ago: 2 * DAY + 5 * HOUR,
    memories: [
      '我妈总说家里那箱老照片该整理了，念了两年也没动手。',
      '我爸退休后一直想学着做面包，工具却迟迟没买。',
      '他们上次视频时说，家里那把旧椅子坐着腰疼。',
    ],
    answers: {
      recipient: '父母',
      occasion: '节日',
      timing: '两到四周',
      budget: '¥600–1500',
      personality: ['温柔 / 居家', '爱做饭 / 美食'],
      taboo: ['不要太贵重、会有负担'],
      feeling: '温暖踏实，觉得被照顾',
      style: ['实物礼物', '体验类（活动/课程/旅行）'],
    },
  },
  {
    ago: 9 * DAY + 2 * HOUR,
    memories: [
      '大学四年一起绕操场跑步，她说毕业后想继续跑马拉松。',
      '我们熬夜赶完最后一份作业时说好，以后每年都要见一面。',
      '她说毕业后要去另一个城市，最舍不得的是这里的天台。',
    ],
    answers: {
      recipient: '闺蜜 / 好友',
      occasion: '毕业 / 里程碑',
      timing: '一个月以上',
      budget: '¥150–300',
      personality: ['活力 / 爱运动', '时尚 / 潮流'],
      taboo: [],
      feeling: '惊喜，完全没想到',
      style: ['实物礼物', '数字内容（视频/画/歌）'],
    },
  },
]

/** 第几轮填充：换一套 memory + 把时间再往前推，避免重复点击造出一模一样的三条 */
const round = ref(0)
const busy = ref(false)

const label = computed(() => (history.count ? '再来 3 份示例' : '载入 3 份示例方案'))

function seed() {
  if (busy.value) return
  busy.value = true
  const n = round.value
  const now = Date.now()
  let ok = 0

  DEMOS.forEach((demo, i) => {
    try {
      const answers = {
        ...demo.answers,
        memory: demo.memories[n % demo.memories.length] || demo.memories[0] || '',
      }
      const plan = generateMockPlan(answers)
      const updatedAt = now - demo.ago - n * 3 * DAY - i * 60 * 1000
      history.save({
        id: uid('plan'),
        createdAt: updatedAt - 42 * 60 * 1000,
        updatedAt,
        answers,
        ...plan,
      })
      ok += 1
    } catch {
      /* 单条失败不影响其余的 */
    }
  })

  round.value = n + 1
  busy.value = false
  if (ok) ui.success(`已载入 ${ok} 份示例方案`)
  else ui.error('示例数据生成失败')
}
</script>

<template>
  <div v-if="isDev" class="seeder">
    <p class="seeder__note">演示数据 · 只在开发环境出现</p>
    <GButton variant="ghost" size="sm" :loading="busy" @click="seed">{{ label }}</GButton>
  </div>
</template>

<style scoped>
.seeder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: var(--s-5) var(--page-x) 0;
}
.seeder__note {
  font-size: var(--fs-micro);
  letter-spacing: 0.04em;
  color: var(--c-ink-4);
}
.seeder :deep(.g-btn--ghost) {
  box-shadow: inset 0 0 0 1px var(--c-line);
}
</style>
