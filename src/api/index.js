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

/** 生成完整送礼方案（可流式：传 onProgress 接收阶段性文案） */
export const generatePlan = (...args) => adapter.generatePlan(...args)

/** 单条追问 / 自由对话（预留：把用户的补充说明交给 LLM） */
export const chatOnce = (...args) => adapter.chatOnce(...args)

/** 重新生成一封信 */
export const regenerateLetter = (...args) => adapter.regenerateLetter(...args)

/** 换一批礼物 */
export const shuffleGifts = (...args) => adapter.shuffleGifts(...args)

/** 创建分享链接 */
export const createShare = (...args) => adapter.createShare(...args)

/** 读取分享内容（收礼人视角） */
export const fetchShare = (...args) => adapter.fetchShare(...args)

export default {
  isMock,
  generatePlan,
  chatOnce,
  regenerateLetter,
  shuffleGifts,
  createShare,
  fetchShare,
}
