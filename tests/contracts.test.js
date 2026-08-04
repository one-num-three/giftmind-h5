import { describe, expect, it } from 'vitest'
import { SERVICE_STATE, assertPlan, normalizeServiceStatus } from '@/api/contracts'

describe('H5 API contracts', () => {
  it('normalizes service states', () => {
    expect(normalizeServiceStatus({ ok: true, deepseekConfigured: true, activeGiftCount: 12 }).state).toBe(SERVICE_STATE.connected)
    expect(normalizeServiceStatus({ ok: true, deepseekConfigured: false, activeGiftCount: 12 }).state).toBe(SERVICE_STATE.ruleFallback)
    expect(normalizeServiceStatus({ ok: true, deepseekConfigured: true, activeGiftCount: 0 }).state).toBe(SERVICE_STATE.emptyCatalog)
    expect(normalizeServiceStatus({ ok: false }).state).toBe(SERVICE_STATE.unavailable)
  })

  it('rejects incomplete plan payloads', () => {
    expect(() => assertPlan({ gifts: [] })).toThrow('信件')
    expect(assertPlan({ gifts: [], letter: {}, ritual: [] })).toEqual({ gifts: [], letter: {}, ritual: [] })
  })
})
