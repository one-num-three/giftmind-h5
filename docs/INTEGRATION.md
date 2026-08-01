# 接入真实后端 / LLM

前端已经把「Mock」和「真实后端」隔离在 `src/api/` 一层里。切换只需要改环境变量，
业务页面和 store 一行都不用动。

```bash
# .env.production
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://api.giftmind.xxx/v1
VITE_API_TIMEOUT=60000
```

`src/api/index.js` 会据此选择 `mockAdapter` 或 `realAdapter`。

---

## 后端需要实现的 6 个接口

约定统一返回 `{ code: 0, message: 'ok', data: ... }`，`code !== 0` 前端会抛 `ApiError`。

### 1. 生成方案（非流式）

```
POST /plans/generate
body: { answers, prompt }     // prompt 由前端 buildPlanPrompt() 生成，后端可忽略自己拼
→ data: Plan                  // 结构见 src/api/prompt.js 的 PLAN_SCHEMA
```

### 2. 生成方案（流式，推荐）

```
POST /plans/generate/stream
Accept: text/event-stream
→ data: {"delta":"...部分 JSON..."}
  data: {"delta":"..."}
  data: [DONE]
```

前端 `streamSSE()` 会把所有 `delta` 拼起来，`[DONE]` 后 `JSON.parse` 得到 Plan。
如果你想在过程中推「阶段文案」而不是 JSON 片段，把 `realAdapter.generatePlan` 的
`onProgress` 分支改成推 `{stage, text}` 帧，最后一帧再给完整 JSON —— 生成过场页只依赖
`planStore.progressStage` 的 `{ key, label, hint }`，换成后端推的字段即可。

### 3. 追问 / 自由对话

```
POST /chat
body: { messages: [{role, content}], answers }
→ data: { reply: string }
```

### 4. 重写信件

```
POST /plans/:id/letter
body: { tone }                // 克制真诚 / 俏皮 / 郑重 / 温暖 / 热烈
→ data: Letter                // { salutation, paragraphs[], signature, tone }
```

### 5. 换一批礼物

```
POST /plans/:id/gifts/shuffle
body: { exclude: string[] }   // 已经出现过的 gift.id
→ data: Gift[]
```

### 6. 分享

```
POST /shares
body: { planId, config }      // config 见下方「分享配置」
→ data: { shareId, url }

GET /shares/:shareId
→ data: { planId, config, plan }   // plan 需内联返回，收礼人不登录也要能看
```

---

## LLM 侧怎么写

`src/api/prompt.js` 是**前后端共用的 prompt 资产**，直接复制到服务端即可：

- `SYSTEM_PROMPT` —— 策划师人设与 6 条硬约束（预算不越界、禁忌不出现、时间不够不推定制…）
- `PLAN_SCHEMA` —— 方案的 JSON Schema，建议开启模型的 JSON mode / structured output
- `buildPlanPrompt(answers)` —— 把问卷答案拼成 user prompt

推荐的服务端流程：

```
answers → buildPlanPrompt → LLM(JSON mode, schema=PLAN_SCHEMA)
       → 校验 JSON（缺字段就重试一次）
       → 用商品库对 gifts 做一次「可获得性」校验（有货 / 价格 / 时效）
       → 落库 → 返回 Plan
```

**注意**：模型直出的礼物名可能买不到。建议服务端保留一份真实目录，让模型只返回
目录里的 `catalogId`，再由服务端把对应的 `gift_idea`、`offers[]` 和 `variants[]`
拼回方案。本仓库的目录契约见 [`docs/DATA_MODEL.md`](DATA_MODEL.md)，Mock 数据的
标准化入口是 `mock/catalog.js`。不要让模型自由生成商品链接、库存或实时价格。

---

## 数据结构速查

### Plan

```ts
{
  id, createdAt, updatedAt,
  answers,                 // 原始问卷答案，方便复现与再生成
  title,                   // ≤12 字
  subtitle,
  insight: { summary, traits: string[], keyPoint },
  gifts: [{
    id, catalogId, emoji, name, why, price, category,
    kind, format,                            // product | activity
    tags: string[], matchScore: number,      // 0-100
    tip, leadTime
  }],
  letter: { salutation, paragraphs: string[], signature, tone },
  ritual: [{ time, title, desc }],
  share:  { greeting, coverEmoji, theme }    // theme: dawn|dusk|sage
}
```

### 分享配置（`createShare` 的 config）

```ts
{
  theme, salutation, greeting, coverEmoji, signature,
  showGifts: boolean, showRitual: boolean,
  showSignature: boolean, allowReply: boolean
}
```

---

## 上线前的几件事

1. **登录态**：`src/api/request.js` 已经会读 `localStorage.gm_token` 拼 `Authorization`，
   补一个登录页写入 token 即可。
2. **历史数据**：`src/stores/history.js` 目前读写 localStorage，接后端后只需替换
   文件顶部的 `read()` / `write()` 两个函数。
3. **分享页 SEO / 微信卡片**：`index.html` 里有 OG 标签占位；如果要每个分享链接有
   不同的标题和缩略图，需要服务端对 `/s/:id` 做 SSR 或预渲染（当前是 hash 路由，
   爬虫拿不到内容）。
4. **图片**：全站零图片资源，所有插画都是 CSS/SVG 画的。接入真实商品图时建议
   在 `GiftCard` 里加一个可选的 `image` 字段并做懒加载。
5. **埋点**：建议在 `router.afterEach`（页面曝光）和 `session.answer`（每题作答）
   两处接入，这两个点能还原完整漏斗。
