/**
 * 5 轮深度出题与防死循环全生命周期自动化评估器
 */
import { fetchNextDynamicQuestion, INITIAL_STEP } from '../src/api/aiQuestionEngine.js'
import { generateAiPlan, getLiveReaction } from '../src/api/mimoService.js'
import { classifyRelationship } from '../src/utils/relationship.js'
import { retrieveCandidates } from '../src/api/catalogService.js'

const TEST_ROUNDS = [
  {
    name: 'Round 1: 8岁男孩·高达机甲拼装与免胶卡扣 (测试具体型号深度)',
    steps: [
      { key: 'recipient', val: '孩子 / 晚辈' },
      { key: 'child_trait', val: '潮玩动漫与动手模型 / 喜欢拼装机甲、手办与模型收藏' },
      { key: 'child_specific_item', val: '科幻未来可动机甲 / 如 关节可动拼装战甲、高达模型' },
      { key: 'assembly_difficulty', val: '免胶卡扣独立上手 / 步骤清晰友好，孩子自己动手能独立搞定' },
      { key: 'budget', val: '¥300–600 品质进阶款（如 Jellycat中号玩偶/北极狐双肩包/进阶套组）' }
    ]
  },
  {
    name: 'Round 2: 60岁母亲·家务操劳与肩颈理疗 (测试长辈减负深度)',
    steps: [
      { key: 'recipient', val: '父母 / 长辈' },
      { key: 'pain_point', val: '家务操劳 / 弯腰拖地与做饭备菜繁重' },
      { key: 'elder_specific_solution', val: '肩颈理疗加足疗舒缓 / 彻底卸下一天家务带来的筋骨酸痛' },
      { key: 'operation_preference', val: '实实在在天天用得上，长辈舍不得闲置、觉得特别实用' },
      { key: 'budget', val: '¥300–600 黄金品质大件 / 专业肩颈推拿理疗半日' }
    ]
  },
  {
    name: 'Round 3: 父母长辈·老照片回忆与精神念想 (测试定制画册深度)',
    steps: [
      { key: 'recipient', val: '父母 / 长辈' },
      { key: 'pain_point', val: '精神念想 / 老照片回忆与陪伴挂念' },
      { key: 'elder_specific_solution', val: '老照片整理归册 / 将箱底泛黄旧照高清扫描排版，翻印成定制精装画册' },
      { key: 'operation_preference', val: '有子女陪伴在侧，深深感受到被放在心上的孝心与关怀' },
      { key: 'budget', val: '¥100–300 贴心小件 / 晨练早餐 / 老电影专场' }
    ]
  },
  {
    name: 'Round 4 (用户截图复现场景): 女朋友·两周年纪念日·潮流户外 (验证绝不卡死在预算)',
    steps: [
      { key: 'recipient', val: '女朋友 / 妻子' },
      { key: 'occasion_scene', val: '恋爱/结婚周年纪念日，希望极具仪式感与专属纪念' },
      { key: 'lover_preference_domain', val: '潮流户外与新鲜体验 / 喜欢轻量徒步、露营看星空与旅行装备' },
      { key: 'lover_specific_item', val: '蕉下轻量化户外双肩包 / 可扩容轻便设计，短途出游颜值爆表' },
      { key: 'budget', val: '¥300–600 浪漫高质感心仪首选（如 星星项链/蓝眼泪/旅行箱）' }
    ]
  },
  {
    name: 'Round 5: 闺蜜好友·生日日常小确幸·生活美学治愈',
    steps: [
      { key: 'recipient', val: '闺蜜 / 好友' },
      { key: 'occasion_scene', val: '生日庆祝 / 送一份兼具颜值与实用性的心仪好物' },
      { key: 'friend_specific_item', val: 'Jellycat 米色甜美小兔 / 治愈系毛绒玩偶，摆在书桌超暖心' },
      { key: 'budget', val: '¥100–300 贴心心意好物' }
    ]
  }
]

async function runTests() {
  console.log('====================================================')
  console.log('🚀 GiftMind 5 轮深度出题与防死循环自检')
  console.log('====================================================\n')

  let passed = 0

  for (let rIdx = 0; rIdx < TEST_ROUNDS.length; rIdx++) {
    const tr = TEST_ROUNDS[rIdx]
    console.log(`▶️ 【测试轮次 ${rIdx + 1}】: ${tr.name}`)
    const answers = {}
    const messages = []
    let stepCount = 0
    let hasDuplicateQuestion = false
    const askedKeys = new Set()

    for (const step of tr.steps) {
      stepCount++
      answers[step.key] = step.val
      messages.push({ role: 'user', text: step.val })

      if (askedKeys.has(step.key)) {
        console.error(`   ❌ 发生重复提问: key=${step.key}`)
        hasDuplicateQuestion = true
      }
      askedKeys.add(step.key)

      // 模拟获取下一题
      const next = await fetchNextDynamicQuestion(answers, messages, stepCount)
      if (next.isReady) {
        console.log(`   ✅ 第 ${stepCount} 题（回答 ${step.key}）后顺利判定完成 (isReady=true)，无多余死循环！`)
        break
      } else {
        const qText = next.messages?.[0] || '提问'
        console.log(`   ➔ 第 ${stepCount} 题后生成深度追问: "${qText.slice(0, 40)}..." (key: ${next.key})`)
        if (next.key === 'budget' && answers.budget) {
          console.error(`   ❌ 错误：已回答预算却仍追问预算！`)
          hasDuplicateQuestion = true
        }
      }
    }

    // 验证关系与候选检索
    const rel = classifyRelationship(answers.recipient)
    console.log(`   [1] 关系严格判定: ${answers.recipient} -> ${rel}`)
    const candidates = retrieveCandidates(answers, 6)
    console.log(`   [2] 官方商品库匹配 Top 3:`)
    candidates.slice(0, 3).forEach((c, idx) => {
      console.log(`       #${idx + 1} 《${c.canonical_name || c.name}》 (¥${c.price_min}-${c.price_max})`)
    })

    // 验证方案生成
    console.log(`   [3] 正在生成大模型方案...`)
    const plan = await generateAiPlan(answers)
    if (plan && plan.gifts?.length) {
      console.log(`   [4] 方案生成成功: 《${plan.title}》 - ${plan.subtitle}`)
      console.log(`       推荐礼物: ${plan.gifts.map(g => g.name).join('、')}`)
      console.log(`       信件称呼: ${plan.letter?.salutation} | 落款: ${plan.letter?.signature}`)
      if (!hasDuplicateQuestion) {
        console.log(`   🎉 【Round ${rIdx + 1} 完全合格 PASS】\n`)
        passed++
      } else {
        console.log(`   ⚠️ 【Round ${rIdx + 1} 存在死循环/重复提问】\n`)
      }
    } else {
      console.log(`   ❌ 方案生成失败\n`)
    }
  }

  console.log('====================================================')
  console.log(`🏁 5 轮测试结果: ${passed} / ${TEST_ROUNDS.length} 轮完全通过！`)
  console.log('====================================================')
}

runTests().catch(console.error)
