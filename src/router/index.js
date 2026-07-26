import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 使用 hash 路由：分享链接可以直接丢到任意静态服务器 / OSS / 公众号里，
 * 不需要后端配 history fallback。
 * meta.tab   —— 是否显示底部 Tab
 * meta.depth —— 页面层级，用于决定转场方向
 */
const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingView.vue'),
    meta: { title: 'GiftMind · 懂你的礼物', tab: true, depth: 0 },
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/views/ChatView.vue'),
    meta: { title: '和 AI 聊聊 TA', depth: 1 },
  },
  {
    path: '/generating',
    name: 'generating',
    component: () => import('@/views/GeneratingView.vue'),
    meta: { title: '正在生成方案', depth: 2 },
  },
  {
    path: '/plan/:id?',
    name: 'plan',
    component: () => import('@/views/PlanView.vue'),
    meta: { title: '你的专属方案', depth: 3 },
  },
  {
    path: '/share/edit/:id',
    name: 'share-edit',
    component: () => import('@/views/ShareEditorView.vue'),
    meta: { title: '生成给 TA 的页面', depth: 4 },
  },
  {
    path: '/s/:shareId',
    name: 'share',
    component: () => import('@/views/ShareView.vue'),
    meta: { title: '有人给你准备了一份礼物', standalone: true, depth: 0 },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: '我的方案', tab: true, depth: 0 },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  if (to.meta?.title) document.title = to.meta.title
})

export default router
