import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { classifyRelationship } from '../src/utils/relationship.js'
import { retrieveCandidates, formatCandidatesForPrompt } from '../src/api/catalogService.js'
import { generateAiPlan, getLiveReaction, generateCustomStyleLetter } from '../src/api/mimoService.js'
import { fetchNextDynamicQuestion, INITIAL_STEP } from '../src/api/aiQuestionEngine.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TEST_SCENARIOS = [
  {
    name: 'Round 1: 8岁小男孩·动手机甲模型与科学探索',
    recipient: '孩子 / 晚辈',
    dialogue: [
      { step: 0, answer: '孩子 / 晚辈' },
      { step: 1, answer: '潮玩动漫与动手模型 / 喜欢拼装机甲、手办与模型收藏' },
      { step: 2, answer: '科幻未来机甲 / 关节可动的酷炫拼装战甲（如 高达机甲/变形战甲）' },
      { step: 3, answer: '免胶卡扣独立上手 / 步骤清晰友好，孩子自己动手能独立搞定' },
      { step: 4, answer: '激发专注力与探索欲，在动手过程中锻炼逻辑思维与耐心' },
      { step: 5, answer: '¥300–600 品质进阶热门大套组' },
    ],
    answers: {
      recipient: '孩子 / 晚辈',
      child_trait: '潮玩动漫与动手模型 / 喜欢拼装机甲、手办与模型收藏',
      child_mech_theme: '科幻未来机甲 / 关节可动的酷炫拼装战甲（如 高达机甲/变形战甲）',
      assembly_difficulty: '免胶卡扣独立上手 / 步骤清晰友好，孩子自己动手能独立搞定',
      special_wish: '激发专注力与探索欲，在动手过程中锻炼逻辑思维与耐心',
      budget: '¥300–600',
    },
    forbiddenGifts: ['墨镜', '口红', '唇膏', '推拿', '艾灸', '睡衣', '女士包', '高跟鞋'],
    expectedKeywords: ['机甲', '拼装', '打印机', '相机', 'jellycat', '书包', 'dimoo', '模型', '积木'],
  },
  {
    name: 'Round 2: 60岁母亲·弯腰做饭家务操劳想省心',
    recipient: '父母 / 长辈',
    dialogue: [
      { step: 0, answer: '父母 / 长辈' },
      { step: 1, answer: '家务操劳 / 弯腰拖地与做饭备菜繁重' },
      { step: 2, answer: '真正减负省力，一键操作不费劲，把双手解放出来' },
      { step: 3, answer: '觉得家里添了一件特别实用省心的好东西' },
      { step: 4, answer: '¥300–600 黄金品质实用大件' },
    ],
    answers: {
      recipient: '父母 / 长辈',
      pain_point: '家务操劳 / 弯腰拖地与做饭备菜繁重',
      detail_need: '真正减负省力，一键操作不费劲，把双手解放出来',
      feeling: '觉得家里添了一件特别实用省心的好东西',
      budget: '¥300–600',
    },
    forbiddenGifts: ['巧克力', '口红', '彩妆', '墨镜', '盲盒', '二次元', '露营夜'],
    expectedKeywords: ['家务', '清洁', '推拿', '理疗', '舒缓', '茶', '体检', '照片', '打印机'],
  },
  {
    name: 'Round 3: 父母·想念在外工作的孩子（精神念想与回忆）',
    recipient: '父母 / 长辈',
    dialogue: [
      { step: 0, answer: '父母 / 长辈' },
      { step: 1, answer: '精神念想 / 老照片回忆与陪伴挂念' },
      { step: 2, answer: '定格一家人温情，把回忆翻印成册随时看一看' },
      { step: 3, answer: '感动欣慰，深深感受到被挂念与陪伴' },
      { step: 4, answer: '¥100–300 贴心小件心意好物' },
    ],
    answers: {
      recipient: '父母 / 长辈',
      pain_point: '精神念想 / 老照片回忆与陪伴挂念',
      detail_need: '定格一家人温情，把回忆翻印成册随时看一看',
      feeling: '感动欣慰，深深感受到被挂念与陪伴',
      budget: '¥100–300',
    },
    forbiddenGifts: ['巧克力', '口红', '彩妆', '墨镜', '盲盒', '二次元'],
    expectedKeywords: ['照片', '画册', '写真', '打印机', '相机', '回忆', '茶', '全家'],
  },
  {
    name: 'Round 4: 女朋友·恋爱两周年纪念日（浪漫质感与惊喜）',
    recipient: '女朋友 / 妻子',
    dialogue: [
      { step: 0, answer: '女朋友 / 妻子' },
      { step: 1, answer: '特别节日或生日庆祝' },
      { step: 2, answer: '浪漫走心 / 喜欢仪式感与专属纪念' },
      { step: 3, answer: '¥600–1200' },
    ],
    answers: {
      recipient: '女朋友 / 妻子',
      occasion_scene: '特别节日或生日庆祝',
      style_preference: '浪漫走心 / 喜欢仪式感与专属纪念',
      budget: '¥600–1200',
    },
    forbiddenGifts: ['中老年推拿', '体检', '老字号早茶', '戏曲'],
    expectedKeywords: ['项链', '手链', '施华洛世奇', '香水', '包', '露营', 'jellycat', '写真', '口红'],
  },
  {
    name: 'Round 5: 闺蜜/好友·生日实用与生活美学',
    recipient: '闺蜜 / 好友',
    dialogue: [
      { step: 0, answer: '闺蜜 / 好友' },
      { step: 1, answer: '日常浪漫小确幸' },
      { step: 2, answer: '热爱生活 / 美食咖啡与居家治愈' },
      { step: 3, answer: '¥100–300' },
    ],
    answers: {
      recipient: '闺蜜 / 好友',
      occasion_scene: '日常浪漫小确幸',
      style_preference: '热爱生活 / 美食咖啡与居家治愈',
      budget: '¥100–300',
    },
    forbiddenGifts: ['体检', '戏曲', '中老年推拿'],
    expectedKeywords: ['jellycat', '香氛', '马克杯', '咖啡', '唇泥', '小卡', '玩偶'],
  },
]

async function runEvaluator() {
  console.log('====================================================')
  console.log('🚀 GiftMind 大模型全生命周期 5 轮实战测试与评估')
  console.log('====================================================\n')

  let passCount = 0

  for (let round = 0; round < TEST_SCENARIOS.length; round++) {
    const sc = TEST_SCENARIOS[round]
    console.log(`\n▶️ 【测试轮次 ${round + 1}】: ${sc.name}`)
    console.log(`----------------------------------------------------`)

    // 1. 关系判定测试
    const detectedRel = classifyRelationship(sc.recipient)
    console.log(`[1] 关系分类判定: ${sc.recipient} ➔ ${detectedRel}`)

    // 2. 模拟多轮追问与即时接话
    console.log(`[2] 模拟多轮对话流:`)
    for (const d of sc.dialogue) {
      const reaction = await getLiveReaction({ id: `step_${d.step}` }, d.answer, { recipient: sc.recipient })
      console.log(`   用户回答 [第 ${d.step + 1} 题]: "${d.answer}"`)
      console.log(`   ➔ AI 实时接话 (Live Reaction): "${reaction}"`)
    }

    // 3. RAG 候选池检索
    const candidates = retrieveCandidates(sc.answers, 10)
    console.log(`[3] 官方 164 数据库检索 Top 5:`)
    candidates.slice(0, 5).forEach((c, idx) => {
      console.log(`   #${idx + 1} 《${c.canonical_name || c.name}》 (${c.price_min}-${c.price_max}元) [${c.category || c.kind}]`)
    })

    // 4. 大模型方案生成
    console.log(`[4] 正在调用 AI 大模型生成专属方案...`)
    const startTime = Date.now()
    const plan = await generateAiPlan(sc.answers)
    const elapsed = Date.now() - startTime
    console.log(`   生成耗时: ${(elapsed / 1000).toFixed(2)}s`)

    if (!plan || !plan.gifts || !plan.gifts.length) {
      console.error(`   ❌ 方案生成失败!`)
      continue
    }

    console.log(`   方案主标题: 《${plan.title}》 - ${plan.subtitle}`)
    console.log(`   AI 推荐礼物清单:`)
    plan.gifts.forEach((g, idx) => {
      console.log(`     (${idx + 1}) [${g.tag || '推荐'}] ${g.name} (${g.price}) - 理由: ${g.why}`)
    })

    console.log(`   信件口吻审核:`)
    console.log(`     称呼: ${plan.letter?.salutation}`)
    console.log(`     正文节选: ${plan.letter?.paragraphs?.[0]}`)
    console.log(`     落款: ${plan.letter?.signature}`)

    // 5. 自动合规性与排雷判定
    const giftNames = plan.gifts.map((g) => g.name).join(' ')
    let hasForbidden = false
    for (const fb of sc.forbiddenGifts) {
      if (giftNames.includes(fb)) {
        hasForbidden = true
        console.error(`   ❌ 发现违禁排雷商品: ${fb}!`)
      }
    }

    // 信件口吻合规性
    let toneValid = true
    if (detectedRel === 'junior') {
      if (/过去|翻篇|情侣|深爱|暧昧|前任|老公|老婆/.test(JSON.stringify(plan.letter))) {
        toneValid = false
        console.error(`   ❌ 信件包含成人口吻，未能通过儿童合规审查!`)
      }
    }

    if (!hasForbidden && toneValid) {
      console.log(`   ✅ 评估结果: 【完全合格 (PASS)】 选品精准、口吻得体、排雷彻底！`)
      passCount++
    } else {
      console.log(`   ⚠️ 评估结果: 【需优化 (NEEDS OPTIMIZATION)】`)
    }
  }

  console.log('\n====================================================')
  console.log(`🏁 5 轮全生命周期测试完成: ${passCount} / ${TEST_SCENARIOS.length} 轮完全通过！`)
  console.log('====================================================')
}

runEvaluator().catch(console.error)
