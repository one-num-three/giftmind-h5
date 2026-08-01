/**
 * Mock 目录出口。
 * 真实后端接入后，只需要让 API 返回同一份 catalog record 形状，推荐器和页面
 * 就可以逐步从这里切出去。
 */
import { GIFT_LIBRARY } from './giftLibrary.js'
import { summarizeCatalog, validateCatalog } from '../src/data/catalogSchema.js'

export const GIFT_CATALOG = GIFT_LIBRARY
export const CATALOG_SUMMARY = summarizeCatalog(GIFT_CATALOG)

export function getGiftById(id) {
  return GIFT_CATALOG.find((gift) => gift.id === id) || null
}

export function searchGiftCatalog(query = '') {
  const needle = String(query).trim().toLowerCase()
  if (!needle) return [...GIFT_CATALOG]
  return GIFT_CATALOG.filter((gift) => gift.search.text.toLowerCase().includes(needle))
}

export function validateDemoCatalog() {
  return validateCatalog(GIFT_CATALOG)
}
