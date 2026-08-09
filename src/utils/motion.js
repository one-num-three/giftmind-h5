export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function routeDirection(nextDepth, previousDepth) {
  return Number(nextDepth || 0) >= Number(previousDepth || 0) ? 1 : -1
}

export function routeMotionSpec(direction = 1, reduced = false) {
  const sign = direction < 0 ? -1 : 1
  if (reduced) {
    return {
      enterFrom: { autoAlpha: 0 },
      enterTo: { autoAlpha: 1, duration: 0.01 },
      leaveTo: { autoAlpha: 0, duration: 0.01 },
    }
  }
  return {
    enterFrom: { autoAlpha: 0, x: sign * 18, willChange: 'transform, opacity' },
    enterTo: {
      autoAlpha: 1,
      x: 0,
      force3D: true,
      duration: 0.34,
      ease: 'power3.out',
    },
    leaveTo: {
      autoAlpha: 0,
      x: sign * -8,
      force3D: true,
      willChange: 'transform, opacity',
      duration: 0.14,
      ease: 'power2.in',
    },
  }
}
