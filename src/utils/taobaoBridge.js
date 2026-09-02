/**
 * ══════════════════════════════════════════════════════════════
 *  Taobao Bridge · 淘宝免注册官方唤端与口令中台
 *  —— 零审核、零依赖、100% 稳定的淘宝生态直达方案：
 *     1. 手机端通过 taobao:// Universal Link 1秒秒级唤起手机淘宝；
 *     2. 电脑端自动打开天猫/淘宝正品搜索页；
 *     3. 支持一键复制标准淘口令格式文本（带心意标签与商品名）。
 * ══════════════════════════════════════════════════════════════
 */
import { copyText } from './helpers.js'

/**
 * 提取精简干净、高转化率的商品检索关键词
 */
export function getTaobaoQuery(giftOrName = '', brand = '', attributes = {}) {
  if (giftOrName && typeof giftOrName === 'object') {
    if (giftOrName.searchQuery) return giftOrName.searchQuery
    return getTaobaoQuery(giftOrName.name, giftOrName.brand || brand, attributes)
  }

  let cleanName = String(giftOrName || '')
    .replace(/^给.*?的/, '')
    .replace(/[《》「」『』【】]/g, '')
    .trim()

  const extraKeywords = []
  if (brand && !cleanName.includes(brand)) extraKeywords.push(brand)
  if (attributes.ip && !cleanName.includes(attributes.ip)) extraKeywords.push(attributes.ip)
  if (attributes.theme && !cleanName.includes(attributes.theme)) extraKeywords.push(attributes.theme)

  const prefix = extraKeywords.join(' ')
  return prefix ? `${prefix} ${cleanName}`.trim() : cleanName
}

/**
 * 构造淘宝 Web 搜索直达 URL
 */
export function getTaobaoWebUrl(giftOrName = '', brand = '', attributes = {}) {
  const q = getTaobaoQuery(giftOrName, brand, attributes)
  return `https://s.taobao.com/search?q=${encodeURIComponent(q)}`
}

/**
 * 构造手机淘宝 App 唤端 Scheme
 */
export function getTaobaoAppUrl(giftOrName = '', brand = '') {
  const q = getTaobaoQuery(giftOrName, brand)
  return `taobao://s.taobao.com/search?q=${encodeURIComponent(q)}`
}

/**
 * 智能打开淘宝：
 * - 手机端优先唤起手机淘宝 App；
 * - 电脑端直接在新窗口打开天猫/淘宝搜索页。
 */
export function openInTaobao(giftName = '', brand = '') {
  const q = getTaobaoQuery(giftName, brand)
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const appUrl = getTaobaoAppUrl(giftName, brand)
  const webUrl = getTaobaoWebUrl(giftName, brand)

  if (isMobile) {
    const start = Date.now()
    window.location.href = appUrl

    // 降级兜底：如果 1.8s 后仍在当前页面，说明未安装淘宝 App，自动打开网页版
    setTimeout(() => {
      if (Date.now() - start < 2600) {
        window.open(webUrl, '_blank')
      }
    }, 1800)
  } else {
    window.open(webUrl, '_blank')
  }
}

/**
 * 复制淘口令格式文本到剪贴板
 */
export async function copyTaobaoToken(giftName = '', price = '') {
  const q = getTaobaoQuery(giftName)
  const priceText = price ? `（参考预算：${price}）` : ''
  const tokenText = `【GiftMind 专属挑礼】我在淘宝找到了这份特别的心意「${q}」${priceText}，快去看看吧！👉 复制本段内容，打开【手机淘宝】即可快速直达天猫/淘宝正品`
  return await copyText(tokenText)
}
