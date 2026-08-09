export function createEmptyPreferenceAnswers() {
  return {
    recipient: '',
    recipientAge: '',
    occasion: '',
    timing: '',
    budget: '',
    personality: [],
    taboo: [],
    memory: '',
    relationshipNote: '',
    feeling: '',
    style: [],
    cityTierCode: '',
    allParticipantsAdults: null,
  }
}

export function createExamplePreferenceAnswers() {
  return {
    recipient: '女朋友 / 妻子',
    recipientAge: '26–40岁',
    occasion: '纪念日',
    timing: '一周内',
    budget: '¥300–600',
    personality: ['文艺 / 小众', '户外 / 自然'],
    taboo: ['不要太张扬、怕尴尬'],
    memory: '她喜欢拍照、逛展和探索城市，也珍惜两个人一起创造的回忆。希望礼物有纪念意义，但不要太张扬。',
    relationshipNote: '稳定期，想制造一点新鲜感',
    feeling: '被深深理解，感动到想哭',
    style: [],
    cityTierCode: 'tier_2',
    allParticipantsAdults: true,
  }
}
