function giftId(gift) {
  return gift?.catalogId || gift?.id || ''
}

function giftList(value) {
  return Array.isArray(value) ? value.filter((gift) => gift && typeof gift === 'object') : []
}

export function giftsForShare(plan = {}) {
  if (plan?.selectedGift && typeof plan.selectedGift === 'object') {
    return [plan.selectedGift]
  }

  const direct = giftList(plan?.gifts)
  const ranked = giftList(plan?.recommendationGroups)
    .flatMap((group) => giftList(group?.candidates))
  const selectedId = String(plan?.selectedGiftId || '').trim()
  if (selectedId) {
    const selected = [...direct, ...ranked].find((gift) => giftId(gift) === selectedId)
    if (selected) return [selected]
  }
  return direct
}
