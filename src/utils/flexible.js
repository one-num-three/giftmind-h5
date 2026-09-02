/**
 * 移动端等比适配
 * 设计稿宽 375px → 1rem = 37.5px；桌面端收口到 --app-max-w (480px)
 * 与 postcss-pxtorem (rootValue: 37.5) 配套使用：业务代码直接写设计稿 px 即可。
 */
const DESIGN_WIDTH = 375
const MAX_WIDTH = 480
const ROOT_VALUE = 37.5

function setRootFontSize() {
  const width = Math.min(
    document.documentElement.clientWidth || window.innerWidth || DESIGN_WIDTH,
    MAX_WIDTH,
  )
  const fontSize = (width / DESIGN_WIDTH) * ROOT_VALUE
  document.documentElement.style.fontSize = `${fontSize}px`
  document.documentElement.dataset.fontSize = String(fontSize)
}

export function setupFlexible() {
  setRootFontSize()
  window.addEventListener('resize', setRootFontSize)
  window.addEventListener('orientationchange', () => setTimeout(setRootFontSize, 120))
  window.addEventListener('pageshow', (e) => e.persisted && setRootFontSize())
}

export { DESIGN_WIDTH, MAX_WIDTH, ROOT_VALUE }
