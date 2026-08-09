import { describe, expect, it } from 'vitest'
import { resolveSteps } from '@/config/flow'

describe('planning conversation safety branches', () => {
  it('always asks the recipient age before recommendation', () => {
    const ids = resolveSteps({}).map((step) => step.id)
    expect(ids.indexOf('recipient_age')).toBeGreaterThan(ids.indexOf('recipient'))
    expect(ids.indexOf('recipient_age')).toBeLessThan(ids.indexOf('occasion'))
  })

  it('recommends both kinds without asking the user to choose a gift form', () => {
    const ids = resolveSteps({}).map((step) => step.id)

    expect(ids).not.toContain('style')
    expect(ids).toContain('all_participants_adults')
    expect(ids).not.toContain('city_tier_code')
  })
})
