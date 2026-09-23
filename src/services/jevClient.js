/**
 * ══════════════════════════════════════════════════════════════
 *  Jev 决策引擎真实 SDK 客户端 (TypeSafe AI / Jev System One Client)
 *  —— 真正连接桌面部署与 TypeSafe 官方服务的 Jev 真实模型：
 *     模型版本: jev-latest (jev-1.13.0)
 *     职责定位: 毫秒级 System 1 快决策 (Intent Classification, Slot Decision, Noul 门禁裁决)
 * ══════════════════════════════════════════════════════════════
 */

const JEV_MODEL = 'jev-latest'

export async function callJevSystemOne({ state, questions, timeout = 6000 }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  const isDevVite = import.meta.env?.DEV || (typeof window !== 'undefined' && Boolean(window.location?.port))
  const endpoint = isDevVite ? '/jev-proxy/v1/systemone' : '/api/jev/systemone'

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: JEV_MODEL,
        state,
        questions,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Jev API HTTP ${res.status}: ${errText}`)
    }

    const data = await res.json()
    return data
  } finally {
    clearTimeout(timer)
  }
}
