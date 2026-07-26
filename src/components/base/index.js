/**
 * 基础组件全局注册
 * 业务页面可直接使用 <GButton> <GCard> …，不必逐个 import。
 */
import GButton from './GButton.vue'
import GCard from './GCard.vue'
import GChip from './GChip.vue'
import GIcon from './GIcon.vue'
import GNavBar from './GNavBar.vue'
import GProgress from './GProgress.vue'
import GSheet from './GSheet.vue'
import GSkeleton from './GSkeleton.vue'
import GEmpty from './GEmpty.vue'
import GToast from './GToast.vue'

const components = {
  GButton,
  GCard,
  GChip,
  GIcon,
  GNavBar,
  GProgress,
  GSheet,
  GSkeleton,
  GEmpty,
  GToast,
}

export function registerBase(app) {
  Object.entries(components).forEach(([name, comp]) => app.component(name, comp))
}

export {
  GButton,
  GCard,
  GChip,
  GIcon,
  GNavBar,
  GProgress,
  GSheet,
  GSkeleton,
  GEmpty,
  GToast,
}
