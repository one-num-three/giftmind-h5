import { describe, expect, it } from 'vitest'

import { nextTabIndex, routeDirection, routeMotionSpec } from '@/utils/motion'

describe('route motion', () => {
  it('follows route depth in both directions', () => {
    expect(routeDirection(3, 1)).toBe(1)
    expect(routeDirection(1, 3)).toBe(-1)
    expect(routeDirection(2, 2)).toBe(1)
  })

  it('removes transforms when reduced motion is requested', () => {
    const normal = routeMotionSpec(1, false)
    const reduced = routeMotionSpec(1, true)

    expect(normal.enterFrom.x).toBe(18)
    expect(normal.leaveTo.x).toBe(-8)
    expect(normal.enterTo.duration + normal.leaveTo.duration).toBeLessThanOrEqual(0.5)
    expect(reduced.enterFrom).toEqual({ autoAlpha: 0 })
    expect(reduced.enterTo.duration).toBe(0.01)
  })

  it('wraps recommendation tabs and supports home/end keys', () => {
    expect(nextTabIndex('ArrowRight', 3, 4)).toBe(0)
    expect(nextTabIndex('ArrowLeft', 0, 4)).toBe(3)
    expect(nextTabIndex('Home', 2, 4)).toBe(0)
    expect(nextTabIndex('End', 1, 4)).toBe(3)
    expect(nextTabIndex('Enter', 2, 4)).toBe(2)
  })
})
