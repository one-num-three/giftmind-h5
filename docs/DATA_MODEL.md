# GiftMind 礼物目录数据模型

这份 H5 目前是静态演示，但推荐结果已经按照后续接数据库的方式组织。现在的 101 条记录是**编辑整理的礼物想法**，不是已经核验过的商品链接或活动库存。数据层会明确标记这个区别，避免后续把演示价格误当成真实报价。

## 三层对象

```text
gift_idea（礼物想法）
├── offers[]（真实平台 / 商家 / 活动场次的报价）
└── variants[]（颜色、尺寸、套餐、人数、规格）
```

### 1. `gift_idea`

回答“这是什么礼物、适合谁、为什么可能合适”。它参与推荐排序，可以没有具体商家。

关键字段：

| 字段 | 说明 | 当前示例 |
| --- | --- | --- |
| `id` | 永久稳定的内部编号，后续不要拿名称当主键 | `g_brass_bookmark` |
| `kind` | 一级类型，只有 `product` 商品或 `activity` 活动 | `product` |
| `category` | 旧版中文展示分类，暂时保留兼容 | `定制` |
| `format` | 稳定的机器值，如 `physical_product`、`custom_product`、`activity` | `custom_product` |
| `fit` | 收礼对象、场合、性格和检索标签 | `recipients / occasions / traits / tags` |
| `constraints` | 禁忌、前置条件和提醒 | “准备定制文字”“确认制作周期” |
| `planning` | 建议提前多久准备；当前只是编辑估计 | `recommendedLeadDays: 7` |
| `pricing` | 价格区间与口径；当前标记为 `estimated` | `¥90–220 / 件` |
| `evidence` | 来源和核验状态 | `verified: false` |
| `quality` | 是否有真实报价、图片、来源 | 当前大多数都缺少 |

### 2. `offers[]`

以后解析淘宝、京东、小红书店铺或活动平台时，把真实信息放在这里，而不是覆盖 `gift_idea.name` 和 `pricing`：

```json
{
  "id": "offer_taobao_xxx",
  "platform": "taobao",
  "url": "https://...",
  "title": "商家页面上的真实标题",
  "seller": { "name": "商家名", "location": "南京" },
  "pricing": {
    "currency": "CNY",
    "min": 99,
    "max": 159,
    "basis": "per_item",
    "capturedAt": "2026-07-31T00:00:00Z"
  },
  "availability": "unknown",
  "evidence": { "capturedAt": "...", "verified": false }
}
```

### 3. `variants[]`

商品有多个颜色、尺寸或套餐时，用变体承载差异；不要为每个颜色复制一条礼物想法：

```json
{
  "id": "variant_black_13",
  "label": "黑色 / 13 英寸",
  "attributes": { "color": "黑色", "size": "13 英寸" },
  "offerId": "offer_taobao_xxx",
  "price": { "min": 899, "max": 999, "currency": "CNY" },
  "image": null
}
```

活动也可以使用 `variants[]`，例如“工作日场 / 周末场”“单人 / 双人”“南京店 / 线上场”。

## 商品与活动的区别

不要只用“实物 / 体验”作为展示标签：

- `kind=product`：购买、定制、数字内容、组合包；重点是规格、变体、发货、库存、平台链接。
- `kind=activity`：课程、门票、旅行、服务；重点是地点、时间、参与人数、预约和场次。
- `category` 是给用户看的中文分类；`format` 是给程序和数据库查询用的稳定枚举。

当前映射：

| category | kind | format | 获取方式 |
| --- | --- | --- | --- |
| 实物 | product | `physical_product` | purchase |
| 定制 | product | `custom_product` | custom_order |
| 数字 | product | `digital_product` | purchase |
| 组合 | product | `bundle` | curated_bundle |
| 体验 | activity | `activity` | booking |

## 数据状态和来源

当前目录所有素材默认是：

```text
dataStatus = seed
evidence.verified = false
pricing.status = estimated
acquisition.inventoryStatus = unknown
```

以后建议按这个流程推进：

1. `seed`：只有礼物想法，允许进入 Mock 推荐。
2. `draft`：采集同学补上来源、图片或一个真实报价。
3. `reviewed`：人工检查名称、类型、价格口径和适用条件。
4. `verified`：来源、价格和可获得性在指定日期核验过。
5. `archived`：失效或不再推荐，但不直接删除历史记录。

## 当前和后续的边界

当前静态库已补上：

- 商品 / 活动一级类型；
- 价格区间、价格单位和“估算”状态；
- 获取方式、履约方式、预约 / 定制要求；
- 适用对象、场合、性格、标签和禁忌；
- 图片、报价、变体和来源的空位；
- 目录校验脚本：`npm run catalog:check`。

后续做真实功能时再接：

- 后台录入和编辑 `gift_idea`；
- 报价 / 链接解析写入 `offers[]`；
- 多规格商品写入 `variants[]`；
- 图片上传和主图选择；
- 价格、库存、活动场次的定期复核；
- 根据 `evidence` 和 `quality` 控制哪些记录可以对外推荐。

## 添加字段的规范

以后新增字段时，先判断它属于哪一层：

1. 说明“这是什么礼物”的字段放在 `gift_idea`。
2. 说明“哪个商家 / 平台 / 场次”的字段放在 `offers[]`。
3. 说明“同一商品的规格差异”的字段放在 `variants[]`。
4. 说明“为什么适合这次送礼”的字段放在 `fit` 或 `constraints`，不要塞进名称或自由文案。

每个新字段都要同时补齐：

```text
字段名：使用 camelCase，避免同义字段并存
数据类型：string / number / boolean / enum / array / object
是否必填：对所有礼物都必填，还是只对 product / activity 必填
数据来源：人工录入 / 页面解析 / LLM 建议 / 系统计算
状态：原始值、估算值、人工确认值或核验值
示例：至少给一条真实形状的 JSON
校验：补进 catalogSchema.js 的 normalize / validate
展示：如果用户需要看到，再补页面；不要为了展示复制一份数据
```

新增枚举或第三种礼物类型时，必须一起更新 `CATEGORY_META`、`GIFT_KINDS` / 对应枚举、校验脚本、`DATA_MODEL.md` 和真实后端迁移说明。旧字段可以保留兼容，但新功能只读标准化字段。
