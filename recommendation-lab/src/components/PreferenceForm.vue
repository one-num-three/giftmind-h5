<script setup>
import { computed, reactive, ref } from 'vue'
import { createEmptyPreferenceAnswers, createExamplePreferenceAnswers } from '../data/preferenceTemplates.js'

defineProps({
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['submit', 'reset'])

const answers = reactive(createEmptyPreferenceAnswers())

const validationMessage = ref('')
const templateMessage = ref('')

const recipientOptions = ['女朋友 / 妻子', '男朋友 / 丈夫', '父母', '闺蜜 / 好友', '同事 / 上司', '孩子 / 晚辈']
const ageOptions = ['未满18岁', '18–25岁', '26–40岁', '41–60岁', '60岁以上', '不确定']
const occasionOptions = ['生日', '纪念日', '节日', '毕业 / 里程碑', '道歉 / 和好', '没有理由，就想送']
const timingOptions = ['就今明两天', '一周内', '两到四周', '一个月以上']
const budgetOptions = ['¥50–150', '¥150–300', '¥300–600', '¥600–1500', '¥1500 以上', '不设上限，看方案']
const personalityOptions = ['文艺 / 小众', '温柔 / 居家', '活力 / 爱运动', '理性 / 极简', '甜食爱好者', '户外 / 自然', '时尚 / 潮流', '音乐 / 影视迷', '爱做饭 / 美食', '数码 / 效率控']
const tabooOptions = ['不要太贵重、会有负担', '不要占地方的大件', '不要花 / 香水等易踩雷', '不要吃的（在控制饮食）', '不要一次性、用完就丢', '不要太张扬、怕尴尬']
const feelingOptions = ['被深深理解，感动到想哭', '惊喜，完全没想到', '甜蜜，感受到被爱', '温暖踏实，觉得被照顾', '纯粹的开心，笑出来']
const cityTierOptions = [
  { value: '', label: '请选择活动城市层级' },
  { value: 'tier_1', label: '一线城市（北京 / 上海 / 广州 / 深圳）' },
  { value: 'tier_2', label: '二线城市（省会、新一线与强二线）' },
  { value: 'tier_3_or_below', label: '三线及以下（地级市、县城与城镇）' },
]

const isRomantic = computed(() => ['女朋友 / 妻子', '男朋友 / 丈夫'].includes(answers.recipient))

function toggleList(key, value, max = Infinity) {
  const list = answers[key]
  const index = list.indexOf(value)
  if (index >= 0) {
    list.splice(index, 1)
    return
  }
  if (list.length < max) list.push(value)
}

function replaceAnswers(nextAnswers) {
  Object.assign(answers, nextAnswers)
}

function applyExampleTemplate() {
  replaceAnswers(createExamplePreferenceAnswers())
  validationMessage.value = ''
  templateMessage.value = '示例已填入，你可以直接提交，也可以先修改任意一项。'
  emit('reset')
}

function clearAnswers() {
  replaceAnswers(createEmptyPreferenceAnswers())
  validationMessage.value = ''
  templateMessage.value = '表单已清空。'
  emit('reset')
}

function submit() {
  const required = [answers.recipient, answers.recipientAge, answers.occasion, answers.timing, answers.budget, answers.feeling, answers.cityTierCode]
  if (required.some((value) => !value) || answers.personality.length === 0) {
    validationMessage.value = '请完成所有标注“必选”的项目。'
    return
  }
  if (answers.allParticipantsAdults === null) {
    validationMessage.value = '推荐会包含体验方案，请确认参与者是否全部成年。'
    return
  }
  validationMessage.value = ''
  emit('submit', JSON.parse(JSON.stringify(answers)))
}
</script>

<template>
  <form class="preference-form" novalidate @submit.prevent="submit">
    <div class="form-shortcuts">
      <div class="shortcut-copy">
        <strong>快速测试一组完整需求</strong>
        <span>填入一套纪念日示例，再按你的真实情况修改。</span>
      </div>
      <div class="shortcut-actions">
        <button type="button" class="secondary-button template-button" :disabled="loading" @click="applyExampleTemplate">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          一键填入示例
        </button>
        <button type="button" class="clear-button" :disabled="loading" @click="clearAnswers">清空</button>
      </div>
    </div>

    <p v-if="templateMessage" class="template-status" role="status">{{ templateMessage }}</p>

    <div class="form-grid form-grid--two">
      <label class="control">
        <span>送给谁 <b>必选</b></span>
        <select v-model="answers.recipient" :disabled="loading">
          <option value="" disabled>请选择关系</option>
          <option v-for="option in recipientOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>

      <label class="control">
        <span>TA 的年龄 <b>必选</b></span>
        <select v-model="answers.recipientAge" :disabled="loading">
          <option value="" disabled>请选择年龄段</option>
          <option v-for="option in ageOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>

      <label class="control">
        <span>送礼场合 <b>必选</b></span>
        <select v-model="answers.occasion" :disabled="loading">
          <option value="" disabled>请选择场合</option>
          <option v-for="option in occasionOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>

      <label class="control">
        <span>送出时间 <b>必选</b></span>
        <select v-model="answers.timing" :disabled="loading">
          <option value="" disabled>请选择时间</option>
          <option v-for="option in timingOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>

      <label class="control">
        <span>预算 <b>必选</b></span>
        <select v-model="answers.budget" :disabled="loading">
          <option value="" disabled>请选择预算区间</option>
          <option v-for="option in budgetOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>

      <label class="control">
        <span>希望 TA 的感受 <b>必选</b></span>
        <select v-model="answers.feeling" :disabled="loading">
          <option value="" disabled>请选择期待感受</option>
          <option v-for="option in feelingOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
    </div>

    <fieldset class="choice-group">
      <legend>TA 的特点 <b>必选，最多 4 项</b></legend>
      <div class="chip-list">
        <label
          v-for="option in personalityOptions"
          :key="option"
          class="choice-chip"
          :class="{ 'is-selected': answers.personality.includes(option) }"
        >
          <input
            type="checkbox"
            :checked="answers.personality.includes(option)"
            :disabled="loading || (!answers.personality.includes(option) && answers.personality.length >= 4)"
            @change="toggleList('personality', option, 4)"
          />
          <span>{{ option }}</span>
        </label>
      </div>
    </fieldset>

    <div class="mix-policy" role="note">
      <strong>默认同时推荐两类</strong>
      <span>实物礼物与体验礼物都会进入候选，不需要你提前决定答案。</span>
    </div>

    <fieldset class="choice-group">
      <legend>明确避开 <span>可多选</span></legend>
      <div class="chip-list">
        <label
          v-for="option in tabooOptions"
          :key="option"
          class="choice-chip"
          :class="{ 'is-selected': answers.taboo.includes(option) }"
        >
          <input
            type="checkbox"
            :checked="answers.taboo.includes(option)"
            :disabled="loading"
            @change="toggleList('taboo', option)"
          />
          <span>{{ option }}</span>
        </label>
      </div>
    </fieldset>

    <div v-if="isRomantic" class="form-grid">
      <label class="control">
        <span>最近的关系状态 <i>可选</i></span>
        <select v-model="answers.relationshipNote" :disabled="loading">
          <option value="">不特别说明</option>
          <option value="甜蜜期，怎么送都开心">甜蜜期</option>
          <option value="稳定期，想制造一点新鲜感">稳定期，想制造新鲜感</option>
          <option value="有点疏远，想拉近一点">想拉近一点</option>
          <option value="刚和好 / 想弥补">刚和好 / 想弥补</option>
        </select>
      </label>
    </div>

    <div class="form-grid form-grid--two conditional-fields">
      <fieldset class="compact-radio">
        <legend>参与者是否全部成年 <b>必选</b></legend>
        <label :class="{ 'is-selected': answers.allParticipantsAdults === true }">
          <input v-model="answers.allParticipantsAdults" type="radio" :value="true" :disabled="loading" />
          <span>是，全部成年</span>
        </label>
        <label :class="{ 'is-selected': answers.allParticipantsAdults === false }">
          <input v-model="answers.allParticipantsAdults" type="radio" :value="false" :disabled="loading" />
          <span>否 / 不确定</span>
        </label>
      </fieldset>

      <label class="control">
        <span>活动城市层级 <b>必选</b></span>
        <select v-model="answers.cityTierCode" :disabled="loading">
          <option v-for="option in cityTierOptions" :key="option.value || 'empty'" :value="option.value" :disabled="!option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>

    <label class="control control--detail">
      <span>关于 TA 的细节 <i>可选，也是唯一的自由描述</i></span>
      <textarea
        v-model.trim="answers.memory"
        :disabled="loading"
        rows="4"
        maxlength="600"
        placeholder="例如：她最近开始拍胶片、常逛书店，不喜欢太张扬的东西。也可以写你们的共同记忆。"
      ></textarea>
      <small>{{ answers.memory.length }}/600</small>
    </label>

    <p v-if="validationMessage" class="form-error" role="alert">{{ validationMessage }}</p>

    <button class="primary-button submit-button" type="submit" :disabled="loading">
      <svg v-if="loading" class="spinner" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="42 16" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h14M14 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {{ loading ? '正在匹配礼物…' : '查看推荐与评分' }}
    </button>
  </form>
</template>
