/**
 * 真实后端适配器（把 VITE_USE_MOCK 设为 false 即启用）
 *
 * 后端只需实现下面 6 个接口，前端一行不用改：
 *   POST /plans/generate        { answers }            -> Plan
 *   POST /plans/generate/stream { answers }            -> SSE，data:{stage,text} / [DONE]
 *   POST /chat                  { messages, answers }  -> { reply }
 *   POST /plans/:id/letter      { tone }               -> Letter
 *   POST /plans/:id/gifts/shuffle { exclude }          -> Gift[]
 *   POST /shares                { planId, config }     -> { shareId, url }
 *   GET  /shares/:shareId                              -> SharePayload
 */
import { http, streamSSE } from './request'
import { buildPlanPrompt } from './prompt'

export async function generatePlan(answers, { onProgress, signal } = {}) {
  if (onProgress) {
    // 流式：后端边生成边推送阶段文案，最后一帧给出完整 JSON
    let jsonText = ''
    await streamSSE('/plans/generate/stream', {
      body: { answers, prompt: buildPlanPrompt(answers) },
      signal,
      onDelta: (delta, full) => {
        jsonText = full
        onProgress(delta, full)
      },
    })
    return JSON.parse(jsonText)
  }
  return http.post('/plans/generate', { answers, prompt: buildPlanPrompt(answers) }, { signal, timeout: 60000 })
}

export async function chatOnce({ messages, answers }, { signal } = {}) {
  const res = await http.post('/chat', { messages, answers }, { signal })
  return res.reply
}

export async function regenerateLetter(planId, { tone } = {}) {
  return http.post(`/plans/${planId}/letter`, { tone })
}

export async function shuffleGifts(planId, { exclude = [] } = {}) {
  return http.post(`/plans/${planId}/gifts/shuffle`, { exclude })
}

export async function createShare(planId, config = {}) {
  return http.post('/shares', { planId, config })
}

export async function fetchShare(shareId) {
  return http.get(`/shares/${shareId}`)
}
