/**
 * API 出口层 —— 业务代码永远从这里 import，不直接碰 mock 或 http。
 *
 * 通过 .env 的 VITE_USE_MOCK 决定走本地 Mock 还是真实后端：
 *   VITE_USE_MOCK=true   前端独立跑通全流程（默认）
 *   VITE_USE_MOCK=false  打到 VITE_API_BASE_URL 指定的网关
 */
import * as mock from './mockAdapter'
import * as real from './realAdapter'

const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

const adapter = USE_MOCK ? mock : real

export const isMock = USE_MOCK

/** 检查 FastAPI、DeepSeek 与推荐池状态。 */
export const getServiceStatus = (...args) => real.getServiceStatus(...args)

/** 生成摘要确认页的四块内容 */
export const generateSummary = (...args) => adapter.generateSummary(...args)

/** 生成完整送礼方案（可流式：传 onProgress 接收阶段性文案） */
export const generatePlan = (...args) => real.generatePlan(...args)

/** 单条追问 / 自由对话（预留：把用户的补充说明交给 LLM） */
export const chatOnce = (...args) => adapter.chatOnce(...args)

/** 重新生成一封信 */
export const regenerateLetter = (...args) => adapter.regenerateLetter(...args)

/** 只替换当前方案中的一件礼物。 */
export const replaceGift = (...args) => real.replaceGift(...args)

/** 只重写仪式，不修改礼物和信件。 */
export const rewriteRitual = (...args) => adapter.rewriteRitual(...args)

/** 围绕用户最终选中的礼物，重写信件与送出步骤。 */
export const composeDelivery = (...args) => adapter.composeDelivery(...args)

/** 换一批礼物 */
export const shuffleGifts = (...args) => real.shuffleGifts(...args)

/** 创建分享链接 */
export const createShare = (...args) => adapter.createShare(...args)

/** 主动用当前方案覆盖一条已有分享。 */
export const updateShare = (...args) => adapter.updateShare(...args)

/** 读取分享内容（收礼人视角） */
export const fetchShare = (...args) => adapter.fetchShare(...args)

export const sendShareReply = (...args) => adapter.sendShareReply(...args)
export const fetchShareReplies = (...args) => adapter.fetchShareReplies(...args)

/** 录音转写：录音 → 文本 → 走现有对话管道 */
export const transcribeVoice = (...args) => adapter.transcribeVoice(...args)

export default {
  isMock,
  getServiceStatus,
  generateSummary,
  generatePlan,
  chatOnce,
  regenerateLetter,
  replaceGift,
  rewriteRitual,
  composeDelivery,
  shuffleGifts,
  createShare,
  updateShare,
  fetchShare,
  sendShareReply,
  fetchShareReplies,
  transcribeVoice,
}
