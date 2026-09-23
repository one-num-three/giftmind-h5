import { describe, expect, it } from 'vitest'
import {
  SERVICE_STATE,
  assertDeliveryComposition,
  assertPlan,
  normalizeServiceStatus,
} from '@/api/contracts'

describe('H5 API contracts', () => {
  it('normalizes service states', () => {
    expect(normalizeServiceStatus({ ok: true, deepseekConfigured: true, activeGiftCount: 12 }).state).toBe(SERVICE_STATE.connected)
    expect(normalizeServiceStatus({ ok: true, deepseekConfigured: false, activeGiftCount: 12, voiceConfigured: true }).voiceConfigured).toBe(true)
    expect(normalizeServiceStatus({ ok: true, deepseekConfigured: false, activeGiftCount: 12 }).voiceConfigured).toBe(false)
    expect(normalizeServiceStatus({ ok: true, deepseekConfigured: false, activeGiftCount: 12 }).state).toBe(SERVICE_STATE.ruleFallback)
    expect(normalizeServiceStatus({ ok: true, deepseekConfigured: true, activeGiftCount: 0 }).state).toBe(SERVICE_STATE.emptyCatalog)
    expect(normalizeServiceStatus({ ok: false }).state).toBe(SERVICE_STATE.unavailable)
  })

  it('keeps marketplace capability separate from real login readiness', () => {
    const status = normalizeServiceStatus({ ok: true, mode: 'web_search', deepseekConfigured: true, searchConfigured: true, searchProvider: 'taobao_jd_browser', searchReadiness: 'not_checked' })
    expect(status.state).toBe(SERVICE_STATE.connected)
    expect(status.searchProvider).toBe('taobao_jd_browser')
    expect(status.searchReadiness).toBe('not_checked')
  })

  it('rejects incomplete plan payloads', () => {
    expect(() => assertPlan({ gifts: [] })).toThrow('信件')
    expect(assertPlan({ gifts: [], letter: {}, ritual: [] })).toEqual({ gifts: [], letter: {}, ritual: [] })
  })

  it('rejects an incomplete selected-gift delivery payload', () => {
    expect(() => assertDeliveryComposition({ letter: {} })).toThrow('送出步骤')
    expect(assertDeliveryComposition({ letter: {}, ritual: [{}] })).toEqual({ letter: {}, ritual: [{}] })
  })
})
