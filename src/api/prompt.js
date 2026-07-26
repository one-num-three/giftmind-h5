/**
 * LLM Prompt 资产层
 * —— 接真实模型时，后端可以直接复用这里的 system prompt 与 JSON Schema，
 *    保证前后端对「方案」这个数据结构的理解完全一致。
 */

export const SYSTEM_PROMPT = `你是 GiftMind 的首席送礼策划师。你的专长不是"推荐商品"，而是"把一个人对另一个人的心意，翻译成一件具体的东西"。

工作原则：
1. 心意优先：礼物本身的价格不重要，重要的是它是否指向送礼人和收礼人之间真实存在的那件事。
2. 具体优于笼统：不说"一条围巾"，而说"一条可以绣上你们初遇日期的羊绒围巾"。
3. 尊重预算：所有推荐必须落在用户给的预算区间内，不得越界向上推销。
4. 尊重禁忌：用户明确说不要的，一次都不要出现。
5. 考虑时间：距离送出时间不足一周时，不推荐需要长时间制作的定制品，或必须给出加急方案。
6. 不煽情过头：文案克制、真诚，不要用力过猛的排比和感叹号。中文写作，语气像一个懂事的朋友。

你必须严格输出 JSON，不要输出任何 JSON 之外的内容。`

/** 方案 JSON Schema（同时是 mock 生成器要遵守的契约） */
export const PLAN_SCHEMA = {
  type: 'object',
  required: ['title', 'insight', 'gifts', 'letter', 'ritual'],
  properties: {
    title: { type: 'string', description: '方案标题，12 字以内' },
    subtitle: { type: 'string', description: '一句话副标题' },
    insight: {
      type: 'object',
      required: ['summary', 'traits'],
      properties: {
        summary: { type: 'string', description: '对这次送礼关系的洞察，60-90 字' },
        traits: { type: 'array', items: { type: 'string' }, description: '3-5 个关键词' },
        keyPoint: { type: 'string', description: '这次送礼最该抓住的一个点' },
      },
    },
    gifts: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        required: ['name', 'why', 'price', 'category'],
        properties: {
          emoji: { type: 'string' },
          name: { type: 'string', description: '礼物名，越具体越好' },
          why: { type: 'string', description: '为什么是它，扣住用户提供的故事，50-80 字' },
          price: { type: 'string', description: '价格区间文案，如 ¥180–360' },
          category: { type: 'string', enum: ['实物', '体验', '定制', '数字', '组合'] },
          tags: { type: 'array', items: { type: 'string' } },
          matchScore: { type: 'number', description: '0-100 契合度' },
          tip: { type: 'string', description: '购买 / 制作的实操建议' },
          leadTime: { type: 'string', description: '需要提前多久准备' },
        },
      },
    },
    letter: {
      type: 'object',
      required: ['paragraphs'],
      properties: {
        salutation: { type: 'string' },
        paragraphs: { type: 'array', items: { type: 'string' }, description: '3-4 段，每段 40-80 字' },
        signature: { type: 'string' },
        tone: { type: 'string', description: '语气标签，如 克制真诚 / 俏皮 / 郑重' },
      },
    },
    ritual: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        required: ['title', 'desc'],
        properties: {
          time: { type: 'string', description: '时间节点，如 提前 3 天' },
          title: { type: 'string' },
          desc: { type: 'string' },
        },
      },
    },
    share: {
      type: 'object',
      properties: {
        greeting: { type: 'string', description: '分享页上的第一句话' },
        coverEmoji: { type: 'string' },
        theme: { type: 'string', enum: ['dawn', 'dusk', 'sage'] },
      },
    },
  },
}

/** 把问卷答案拼成给模型的 user prompt */
export function buildPlanPrompt(answers = {}) {
  const lines = [
    `收礼人：${answers.recipient || '未说明'}`,
    `场合：${answers.occasion || '未说明'}`,
    `距离送出：${answers.timing || '未说明'}`,
    `预算：${answers.budget || '未说明'}`,
    `TA 的性格标签：${toText(answers.personality)}`,
    `要避开的：${toText(answers.taboo) || '无'}`,
    `他们之间的故事 / TA 最近想要的：${answers.memory || '用户没有提供，请用更普适但仍然真诚的角度'}`,
    answers.relationshipNote ? `关系状态：${answers.relationshipNote}` : '',
    `希望对方收到时的感受：${answers.feeling || '被理解'}`,
    `礼物形式偏好：${toText(answers.style)}`,
  ].filter(Boolean)

  return `请为下面这次送礼生成一份完整方案。

${lines.join('\n')}

要求：
- 推荐 3 件礼物，第一件是首选，必须最紧扣"他们之间的故事"。
- 写一封可以直接抄下来的信，不要出现"AI"字样。
- 给一套送礼当天的仪式感步骤，可执行、不尴尬。
- 严格按下面的 JSON Schema 输出：
${JSON.stringify(PLAN_SCHEMA)}`
}

function toText(v) {
  if (!v) return ''
  return Array.isArray(v) ? v.join('、') : String(v)
}
