# GiftMind H5

> AI 送礼策划师 · Vue 3 + Vite 移动端工程骨架
> 从商业草案（`giftmindprototype1.html`）落成的可开发、可演示、可交付的完整框架。

---

## 一分钟跑起来

```bash
npm install
npm run dev        # http://localhost:5173
```

默认走本地 Mock，**不需要任何后端**就能跑通全流程：
首页 → AI 对话问卷 → 生成过场 → 方案结果 → 生成给 TA 的分享页 → 我的方案。

```bash
npm run build      # 产物在 dist/，纯静态，丢 OSS / CDN / Nginx 都能跑
npm run preview    # 本地预览构建产物
```

## Data Studio 设计资料

GiftMind 数据工作台的产品约束与落地计划保存在仓库中，便于后续实现和审阅：

- [设计规格](./docs/superpowers/specs/2026-07-27-giftmind-data-studio-design.md)
- [实施计划](./docs/superpowers/plans/2026-07-27-giftmind-data-studio.md)

数据工作台是独立的本地管理应用；本 H5 项目继续保持 Mock 优先，不会在默认体验中要求后端服务。

---

## 它包含什么

| 模块 | 路由 | 说明 |
| --- | --- | --- |
| 品牌落地页 | `/` | Hero + 痛点 + 流程 + 交付物预览 + 吸底 CTA + 草稿续接 |
| AI 对话问卷 | `/chat` | 打字机气泡、单选/多选/自由输入、条件分支、跳过、回退改答、草稿持久化 |
| 生成中过场 | `/generating` | 逐笔系成蝴蝶结的 SVG 动画 + 阶段文案流 + 完成清单 |
| 方案结果页 | `/plan/:id?` | 洞察、3 件礼物（契合度环/收藏/实操建议）、可换语气的信、仪式时间线 |
| 分享页配置 | `/share/edit/:id` | 实时手机预览、三套主题、称呼/问候语/封面 emoji、四个内容开关 |
| 给 TA 的页面 | `/s/:shareId` | 拆信封动画 + 滚动逐段揭示 + 回一句话（收礼人视角，无 App 感） |
| 我的方案 | `/history` | 搜索、左滑删除（桌面端有降级入口）、空态、示例数据播种器 |

---

## 目录结构

```
giftmind-h5/
├─ index.html                 视口 / 字体 / OG 卡片
├─ vite.config.js             别名、代理、分包
├─ postcss.config.js          px → rem（设计稿 375）
├─ .env.example               环境变量说明
├─ docs/
│  ├─ DESIGN_CONTRACT.md      ★ 开发契约：token / 组件 / store / 数据结构 / 红线
│  └─ INTEGRATION.md          ★ 怎么接真实 LLM 与后端
├─ mock/
│  ├─ giftLibrary.js          101 条礼物知识库 + 信件/仪式/洞察素材库
│  ├─ planGenerator.js        「假 AI」：加权打分匹配 + 信件合成（确定性可复现）
│  └─ generatingSteps.js      生成过场的阶段文案
├─ scripts/
│  └─ walkthrough.mjs         Playwright 全流程走查 + 逐屏截图
└─ src/
   ├─ api/
   │  ├─ index.js             ★ 唯一出口，Mock / 真实后端一行切换
   │  ├─ mockAdapter.js       Mock 实现
   │  ├─ realAdapter.js       真实后端实现（含 SSE 流式）
   │  ├─ request.js           fetch 封装：超时 / 鉴权 / 统一错误 / SSE 解析
   │  └─ prompt.js            ★ system prompt + Plan JSON Schema（前后端共用契约）
   ├─ components/
   │  ├─ base/                10 个全局注册的基础组件（GButton/GCard/GChip/...）
   │  ├─ chat/                气泡、打字点、选项面板、输入区
   │  ├─ gift/                礼物卡、信纸卡、仪式时间线、洞察块、方案列表项
   │  ├─ share/              信封封面、揭示容器、主题选择器
   │  └─ layout/              TabBar、Hero 装饰层、示例数据播种器
   ├─ composables/            useChatFlow（对话导演）、useReveal（滚动揭示）
   ├─ config/flow.js          ★ 对话剧本：改问题 / 加分支不用动页面代码
   ├─ router/index.js         hash 路由（分享链接可直接静态部署）
   ├─ stores/                 session / plan / history / ui
   ├─ styles/                 tokens.css（唯一主题源）/ reset.css / global.css
   └─ utils/                  flexible.js（适配）、helpers.js
```

---

## 四个「改这里就够了」的扩展点

### 1. 改问题 → `src/config/flow.js`

对话剧本是纯数据。加一题、改选项、加条件分支都在这个文件里，页面自动跟着变：

```js
{
  id: 'timing', stage: 'discover', key: 'timing', type: 'single',
  messages: ['离送出还有多久？'],
  options: [{ value: '一周内', label: '一周内', emoji: '📅' }],
  when: (a) => a.recipient === '女朋友 / 妻子',   // 条件分支
  skippable: true, allowCustom: true,
}
```

支持 `single` / `multi` / `text` 三种题型，`minSelect` `maxSelect` `allowCustom` `skippable` `when` `summary` 全部生效。

### 2. 改主题 → `src/styles/tokens.css`

所有颜色、圆角、阴影、字号、间距、动效都是 CSS 变量，组件层没有一处硬编码颜色。
换一套色板只改这一个文件，整站跟着换。当前是「明亮温柔」：奶油白 + 莫兰迪。

### 3. 改内容 → `mock/giftLibrary.js`

101 条礼物、信件句式库、仪式步骤库都在这里。演示前想让方案更贴某个人群，直接加条目。

### 4. 接真实 AI → `.env` 一行

```bash
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://your-gateway/api
```

后端实现 6 个接口即可，前端一行不用改。详见 **[docs/INTEGRATION.md](docs/INTEGRATION.md)**。

---

## 移动端适配

- 设计稿基准 **375px**，业务代码直接写设计稿 px
- `postcss-pxtorem`（rootValue 37.5）在构建时转 rem
- `src/utils/flexible.js` 动态设根字号，桌面端收口到 480px 居中
- `1px` 描边不会被转换，安全区用 `--safe-top` / `--safe-bottom`
- 已在 375×812、430×932、1280 桌面三种宽度走查，无横向溢出

---

## 质量校验

```bash
npm run build                                  # 构建
npx vite preview --port 4173                   # 起服务
node scripts/walkthrough.mjs                   # 全流程走查，截图落在 .walkthrough/
```

`walkthrough.mjs` 会用 Playwright 以 iPhone 尺寸自动跑完整条链路（含填写文本题、拆信封、
切宽屏），逐屏截图并收集 console 错误与横向溢出。当前状态：**30 屏、0 报错、0 溢出**。

> 需要本机有 Playwright 与 Chromium。若浏览器路径不同，用 `CHROME_PATH=/path/to/chrome node scripts/walkthrough.mjs`。

---

## 已知待办（留给下一轮）

- [ ] 会员付费墙与定价页（本轮范围外，路由与 store 已预留位置）
- [ ] 礼物卡跳转电商 / 加购链路（`gift` 数据结构里已留 `tags` / `tip`，可扩 `sku`）
- [ ] 分享页「回一句话」目前只在本地反馈，接后端后走 `POST /shares/:id/replies`
- [ ] 登录态：`request.js` 已读 `localStorage.gm_token`，接入后补登录页即可
- [ ] 方案与历史目前存 localStorage，接后端后把 `stores/history.js` 的 `read/write` 换成接口
- [ ] 埋点：建议在 `router.afterEach` 与 `session.answer` 两处接入
