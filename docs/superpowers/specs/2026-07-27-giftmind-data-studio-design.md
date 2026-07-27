# GiftMind 数据工作台设计规格

- 日期：2026-07-27
- 状态：已完成方案确认，等待书面规格复核
- 产品名称：GiftMind Data Studio（GiftMind 数据工作台）
- 目标仓库：`one-num-three/giftmind-data-studio`
- 目标部署：用户自有 Ubuntu 服务器，现有 Nginx 反向代理

## 1. 背景

GiftMind 当前使用 `mock/giftLibrary.js` 中的静态礼物素材完成演示。现有记录已包含名称、分类、价格区间、适用人群、场合、性格标签、准备周期、禁忌、推荐理由和操作建议，但不具备多人连续采集、图片管理、数据校验、版本修订、导入导出、备份或真实商品渠道管理能力。

本项目要建立一个独立的内部数据采集工具，让少量采集同学通过浏览器持续维护 GiftMind 的第一版礼物知识库。它不面向 GiftMind 的最终用户，也不承担推荐产品本身的用户登录、付费或分享功能。

## 2. 产品目标

第一阶段必须做到：

1. 无个人账号，团队成员输入一个共用口令即可使用。
2. 礼物概念必填，真实商品和商家信息选填。
3. 支持新增、搜索、筛选、查看、修改、复制、软删除、回收站恢复和彻底删除。
4. 使用分区引导工作台完成复杂字段录入，并持续显示完整度和错误检查。
5. 输入礼物名称和简短描述后，可以调用 DeepSeek 生成结构化字段建议。
6. AI 结果必须由人确认，不能直接写入正式数据。
7. 支持本地图片上传、自动压缩和缩略图。
8. 支持 JSON、CSV、Excel、批量导入模板和包含图片的完整备份。
9. 能导出 GiftMind 可直接消费的数据结构。
10. 部署到用户自己的服务器，API Key 永远不进入浏览器代码。

## 3. 非目标

第一阶段明确不做：

- 个人账号、角色、组织、邀请、权限矩阵。
- 实时协同编辑和在线评论。
- 自动爬取电商网站、自动同步库存或自动下单。
- 支付、会员、订单和佣金系统。
- 面向消费者的 GiftMind 推荐页面。
- 向量数据库、知识图谱或复杂搜索集群。
- AI 自动提交、自动发布或自动覆盖人工字段。
- 动态表单设计器。未预见的字段通过“补充属性”键值对保存。
- 对外公开 API。所有写入和 AI 接口都要求有效的团队会话。

## 4. 推荐架构

### 4.1 架构选择

采用独立项目，而不是把内部工具放进公开的 `giftmind-h5`：

- 前端：Vue 3、TypeScript、Vite、Pinia、Vue Router。
- 后端：FastAPI、Pydantic、SQLAlchemy、Alembic。
- 数据库：SQLite，开启 WAL、外键和定期完整性检查。
- 图片：服务器本地持久化目录，Pillow 转换 WebP。
- Excel：OpenPyXL。
- 加密：`cryptography` 的 Fernet。
- 测试：Pytest、Vitest、Playwright。
- 部署：Docker Compose 单应用容器；FastAPI 同时提供 API 和构建后的前端静态文件。
- 外层入口：现有 Nginx 反向代理，支持独立域名或 `/giftmind-data/` 子路径。

选择 FastAPI 而不是全 Node 后端，原因是图片转换、Excel、SQLite 备份、数据校验和 DeepSeek 结构化输出处理更直接。独立项目能隔离内部口令、DeepSeek Key、上传文件和公开 H5 的发布周期。

### 4.2 运行目录

服务器持久化数据不写入容器镜像：

```text
/srv/giftmind-data/
├── data/giftmind.sqlite3
├── uploads/original/
├── uploads/large/
├── uploads/thumb/
├── backups/
├── logs/
└── .env
```

容器升级不得删除以上目录。

## 5. 访问与安全

### 5.1 团队口令

- 不建立个人用户表。
- 首次部署通过环境变量设置团队口令。
- 服务端只保存 Argon2 哈希，不保存明文。
- 登录成功后签发有过期时间的 HttpOnly、SameSite=Lax 会话 Cookie。
- HTTPS 环境下 Cookie 必须启用 Secure。
- 默认会话有效期为 7 天，设置页可调整为 1–30 天。
- 登录失败限制为同一 IP 每 15 分钟 5 次。
- 所有修改、导入、导出、备份、设置和 AI 接口必须校验会话。
- 登出会立即使当前会话失效。

### 5.2 基础防护

- 所有状态修改请求校验 CSRF Token。
- 接口限制请求体大小。
- AI 接口默认每个会话每小时最多 60 次，可配置。
- 上传只接受 JPEG、PNG、WebP 和 HEIC 解码后的有效图片。
- 文件扩展名不能作为格式判断依据，必须解码验证。
- 随机生成存储文件名，禁止用户控制路径。
- 单图原始大小默认不超过 10 MB，每个礼物最多 8 张图片。
- 所有数据访问使用参数化查询。
- 应用不把 DeepSeek Key、团队口令哈希或服务器路径写入日志。

### 5.3 HTTPS 要求

应用本身保持主机名无关。正式供外部网络访问前，Nginx 必须启用 HTTPS。没有 HTTPS 时，系统设置页显示持续警告，并禁止通过网页保存新的 DeepSeek Key；环境变量中的 Key 仍可由服务器使用。

## 6. 页面与交互

### 6.1 口令页

- 单一口令输入框。
- 显示应用名称和简短用途。
- 支持回车提交、显示/隐藏口令和错误提示。
- 不显示用户名、注册、找回密码或成员管理。

### 6.2 数据概览

显示：

- 礼物概念总数、完整记录数、草稿数、待补充数、停用数。
- 有具体商品渠道的礼物数。
- 缺图片、缺来源、长期未核验和疑似重复的记录数。
- 分类、场合、收礼人和预算区间的覆盖情况。
- 最近修改记录。
- “新增礼物”“批量导入”“导出数据”三个主要入口。

### 6.3 礼物数据库列表

- 支持名称、别名、商家、品牌、标签和备注的统一搜索。
- 支持按状态、分类、收礼人、场合、价格、准备周期、图片、商品渠道、完整度和核验日期筛选。
- 默认按最近修改排序。
- 支持表格和卡片两种视图，桌面默认表格。
- 支持批量设为待补充、停用、恢复和导出。
- 单条操作包括查看、编辑、复制、删除。
- 删除进入回收站，不立即物理删除。

### 6.4 分区引导录入工作台

桌面布局：

- 左侧：录入阶段、完成情况和错误数量。
- 中间：当前分区表单。
- 右侧：完整度、重复检查、冲突检查、AI 状态和保存操作。

移动端和窄屏将三栏折叠为顶部进度条、主表单和底部检查抽屉。

工作台分为：

1. 基础信息。
2. 匹配维度。
3. 约束与物流。
4. 商品与商家。
5. 内容与质量。

功能要求：

- 自动保存浏览器本地草稿，但不自动写入服务器正式记录。
- 离开有未保存修改的页面时提示。
- “保存草稿”“保存并继续”“保存并录入下一条”。
- 新建时先做精确名称和模糊名称查重。
- 所有多选字段均有标准选项和“添加自定义值”。
- 提供“补充属性”键值对列表，保存未被标准字段覆盖的信息。
- 复制记录时自动生成新 ID，并清除商品库存核验时间。

### 6.5 回收站

- 显示删除时间、原名称和删除前状态。
- 支持恢复和彻底删除。
- 彻底删除前二次确认，并说明关联商品和图片也会删除。
- 自动清理关闭，除非用户在设置中明确开启。

### 6.6 导入导出

- 提供 JSON、CSV、Excel 和完整备份。
- 提供空白 Excel 模板和带示例的模板。
- Excel 使用 `礼物概念`、`具体商品`、`图片清单`、`数据字典` 四个工作表。
- 导入先上传、解析、预览和校验，用户确认后才写入。
- 错误按工作表、行号、字段和原因展示，并可下载错误报告。
- 支持精确名称、别名和稳定 ID 的重复策略：跳过、更新、复制为新记录。
- 单次导入在数据库事务中完成；发生未处理错误时整批回滚。
- JSON 导出提供“完整内部格式”和“GiftMind 消费格式”。
- 完整备份为 ZIP，包含数据库、图片、设置清单和版本信息，但不包含团队口令明文和 DeepSeek Key。

### 6.7 系统设置

- DeepSeek 连接状态、模型、Base URL、超时、重试和每小时限额。
- API Key 来源状态：环境变量或网页设置。
- 网页只能显示 Key 是否存在和末尾 4 位，不能读取完整 Key。
- 环境变量 Key 优先；存在时网页 Key 不生效。
- 数据字典管理：新增、停用、排序自定义选项；内置核心值不可删除，只能停用。
- 团队口令修改。
- 会话有效期。
- 图片限制。
- 手动备份、备份列表和恢复入口。

## 7. 数据字段

### 7.1 礼物概念 `gifts`

基础字段：

- `id`：UUID。
- `canonical_name`：标准名称，必填。
- `aliases`：别名数组。
- `short_description`：简短描述。
- `category`：实物、体验、定制、数字、组合或自定义值。
- `subcategory`：标准选项或自定义值。
- `status`：draft、needs_review、complete、inactive。
- `emoji`：可选。
- `completeness_score`：服务端计算，0–100。

匹配字段：

- `recipient_types`：伴侣、父母、朋友、同事、孩子等。
- `relationship_stages`：初识、稳定关系、长期关系、正式职场等。
- `age_ranges`：婴幼儿、儿童、青少年、青年、中年、老年等。
- `traits`：文艺、居家、运动、极简、甜食、户外、时尚、影音、美食、数码等。
- `interests`：可扩展多选。
- `occasions`：生日、纪念日、节日、毕业/里程碑、道歉/和好、无理由等。
- `desired_feelings`：被理解、惊喜、甜蜜、温暖、开心等。
- `gift_styles`：实物、体验、定制、数字、组合。
- `memory_hooks`：适合承接的故事或记忆线索。
- `tags`：标准标签。
- `custom_tags`：采集者新增标签。

价格和交付：

- `price_min`、`price_max`：非负整数或两位小数。
- `is_free`：明确标记免费礼物或免费体验；为真时价格区间可为空。
- `currency`：默认 CNY。
- `lead_days_min`、`lead_days_max`。
- `rush_available`。
- `booking_required`。
- `service_regions`。
- `delivery_notes`。

物理和限制字段：

- `size_class`：无实体、小件、中件、大件。
- `weight_grams`：可空。
- `is_bulky`、`is_fragile`、`is_consumable`。
- `shelf_life_days`。
- `storage_requirements`。
- `customizable`。
- `personalization_requirements`。
- `taboo_flags`：价格负担、占地方、香味、食物、一次性、张扬等。
- `allergy_notes`。
- `safety_notes`。
- `unsuitable_groups`。

内容字段：

- `why_template`：推荐理由素材。
- `best_scenarios`。
- `unsuitable_scenarios`。
- `purchase_tip`。
- `ritual_tip`。
- `pairing_ideas`。
- `collector_notes`。
- `extra_attributes`：自定义键值对 JSON。

质量字段：

- `source_notes`。
- `source_urls`。
- `confidence_level`：low、medium、high。
- `verified_at`。
- `created_at`、`updated_at`、`deleted_at`。

### 7.2 具体商品 `gift_offers`

- `id`、`gift_id`。
- `merchant`、`brand`、`offer_name`、`sku`。
- `current_price`、`currency`。
- `stock_status`：unknown、available、limited、unavailable。
- `delivery_days`。
- `service_regions`。
- `purchase_url`。
- `return_policy`。
- `source_url`。
- `verified_at`。
- `active`。
- `created_at`、`updated_at`。

每个礼物概念可关联 0 到多个商品。

### 7.3 图片 `gift_images`

- `id`、`gift_id`。
- 原始文件名和服务器随机文件名。
- `original_path`、`large_path`、`thumb_path`。
- MIME、宽、高、字节数、SHA-256。
- 图片来源说明和使用权说明。
- 排序和封面标记。
- 创建时间。

处理规则：

- 保留原图备份。
- 大图最长边限制为 1600 像素，输出 WebP。
- 缩略图最长边限制为 360 像素，输出 WebP。
- 自动纠正 EXIF 方向并移除不需要的 EXIF 数据。
- 相同 SHA-256 的图片提示重复。

### 7.4 辅助表

- `dimension_options`：标准和自定义数据字典。
- `settings`：非敏感设置和加密后的网页 DeepSeek Key。
- `ai_runs`：模型、耗时、成功状态、Token 用量、错误类型，不保存明文 Key。
- `audit_events`：创建、修改、复制、删除、恢复、导入、导出、设置和备份事件。
- `imports`：导入文件、统计和错误报告。
- `backups`：备份文件、大小、校验值和创建时间。
- `revoked_sessions`：已退出或失效的会话标识。

## 8. DeepSeek 自动补全

### 8.1 调用方式

采集者至少输入礼物名称，可以补充简短描述和人工已知信息，然后点击“AI 智能补全”。

服务端流程：

1. 校验会话和调用频率。
2. 执行本地重复检查。
3. 构造仅包含当前表单数据和标准字典的 Prompt。
4. 调用 OpenAI 兼容的 DeepSeek API。
5. 使用严格 JSON 输出。
6. 通过 Pydantic 校验、清理非法枚举和数值。
7. 返回字段建议和置信说明，不写数据库。
8. 前端以差异视图显示建议。

默认配置：

- Base URL：`https://api.deepseek.com`。
- 模型：`deepseek-chat`。
- Temperature：0.2。
- 超时：45 秒。
- 网络或 5xx 错误重试 1 次。
- 单次建议最多返回 18 个可建议字段。

### 8.2 AI 可以建议的字段

- 分类、子分类。
- 收礼人、关系阶段、年龄段。
- 性格、兴趣、场合、情绪、礼物形式。
- 标准标签、自定义标签、记忆线索。
- 估算价格区间，并显式标记 `estimated`。
- 估算准备周期。
- 定制、预约、体积、易碎、消耗品等属性。
- 禁忌、过敏和安全提醒。
- 推荐理由、适用和不适用场景。
- 购买、仪式和搭配建议。

### 8.3 AI 禁止建议为事实的字段

- 真实商家、品牌、SKU。
- 当前价格和库存。
- 购买链接。
- 配送地区和真实配送时效。
- 来源链接和核验时间。
- 图片来源和使用权。
- 人工可信度。

AI 可以提示这些字段尚待人工核验，但不能编造值。

### 8.4 建议确认

- AI 新增值显示绿色。
- AI 修改人工值显示黄色，并同时展示原值和建议值。
- 冲突或低置信建议显示橙色。
- 支持逐字段接受、拒绝、编辑和接受全部。
- “接受全部”仍不会自动保存，必须点击保存。
- 每次建议保留运行摘要，便于排查质量和成本。

### 8.5 Key 管理

读取优先级：

1. `DEEPSEEK_API_KEY` 环境变量。
2. 网页设置中加密保存的 Key。

网页 Key 使用由 `APP_SECRET` 派生的 Fernet Key 加密。`APP_SECRET` 只能存在服务器环境变量。若 `APP_SECRET` 缺失，网页禁止保存 Key。API 响应永远不返回完整 Key。

## 9. 数据质量规则

保存时必须执行：

- 标准名称不能为空，去除首尾空格后长度为 2–80 字。
- 名称精确重复时阻止新建；高度相似时提示但允许确认后继续。
- 非免费礼物必须填写价格区间，且 `price_min <= price_max`。
- `is_free` 为真时不得同时填写大于零的价格。
- `lead_days_min <= lead_days_max`。
- 价格和周期不能为负数。
- 被标记为无实体的礼物不能同时标记易碎或重量。
- 食物禁忌与食品类礼物冲突时阻止标为完整。
- 香味禁忌与香氛礼物冲突时阻止标为完整。
- 停用礼物不进入 GiftMind 消费格式导出。
- 完整状态要求名称、分类、价格或明确的“免费”、准备周期、至少一个收礼人、场合、标签、推荐理由和来源说明。
- 商品 URL 必须是 HTTP 或 HTTPS。
- 商品核验超过 90 天时显示过期提醒。

完整度由服务端按固定权重计算，前端不自行计算。

## 10. API 边界

主要接口：

```text
POST   /api/session/login
POST   /api/session/logout
GET    /api/session

GET    /api/dashboard
GET    /api/gifts
POST   /api/gifts
GET    /api/gifts/{id}
PUT    /api/gifts/{id}
POST   /api/gifts/{id}/copy
DELETE /api/gifts/{id}
POST   /api/gifts/{id}/restore
DELETE /api/gifts/{id}/purge
POST   /api/gifts/check-duplicates

POST   /api/gifts/{id}/images
DELETE /api/images/{id}
POST   /api/images/{id}/cover

POST   /api/ai/enrich
GET    /api/ai/status

GET    /api/dimensions
POST   /api/dimensions
PUT    /api/dimensions/{id}

POST   /api/imports/preview
POST   /api/imports/{id}/commit
GET    /api/exports/giftmind.json
GET    /api/exports/gifts.csv
GET    /api/exports/gifts.xlsx

GET    /api/settings
PUT    /api/settings
POST   /api/settings/deepseek-key
DELETE /api/settings/deepseek-key

POST   /api/backups
GET    /api/backups
GET    /api/backups/{id}/download
POST   /api/backups/{id}/restore
```

恢复备份属于高风险操作，必须重新输入团队口令并二次确认。

## 11. 导出到 GiftMind

GiftMind 消费格式保持现有匹配器需要的核心字段：

```json
{
  "id": "g_pottery",
  "name": "陶艺拉坯双人课",
  "emoji": "🏺",
  "why": "……",
  "priceLow": 260,
  "priceHigh": 520,
  "category": "体验",
  "traits": ["文艺 / 小众", "温柔 / 居家"],
  "occasions": ["生日", "纪念日"],
  "recipients": ["女朋友 / 妻子", "男朋友 / 丈夫", "闺蜜 / 好友"],
  "leadDays": 3,
  "tags": ["一起完成", "手作", "不占地方"],
  "tip": "……",
  "avoid": []
}
```

导出层负责把数据库的规范字段映射为 GiftMind 当前枚举，不要求前端消费者立即改造。

## 12. 备份与恢复

- 提供应用内手动备份。
- 服务器每天 02:30 通过 cron 调用备份命令。
- 默认保留最近 30 天自动备份。
- 每个备份生成 SHA-256 校验值。
- 备份前执行 SQLite checkpoint 和完整性检查。
- 恢复前自动生成一次“恢复前备份”。
- 恢复流程验证版本、校验值和文件结构。
- 恢复失败时保持原数据库和图片不变。

## 13. 错误处理

- AI 不可用时保留所有人工录入功能。
- AI 超时显示可重试提示，不清空表单。
- 网络断开时持续保留浏览器草稿。
- 图片部分失败时成功图片保留，失败图片逐张显示原因。
- 保存使用幂等请求 ID，避免双击产生重复记录。
- 导入解析错误不写数据库。
- 磁盘剩余空间不足时禁止图片上传和备份，并显示明确告警。
- 所有用户可恢复错误使用中文说明，日志保留技术细节。

## 14. 视觉设计

采用已经确认的 B 方案：

- 桌面优先，适配平板和手机。
- 奶油白背景、深森林绿主色、低饱和金色强调。
- 强调信息密度和清晰层级，不使用装饰性大图。
- 标准控件包括搜索框、筛选 Chips、多选下拉、标签输入、数值区间、日期、图片上传、差异确认、完整度和错误列表。
- 主按钮始终使用明确动作词，如“AI 智能补全”“保存并录入下一条”。
- AI 建议、人工值、错误和缺失状态必须同时依靠文字与颜色区分。
- 键盘可完成主要录入流程，表单有清晰焦点状态和无障碍标签。

## 15. 部署

交付物：

- Dockerfile 和 Docker Compose。
- `.env.example`。
- 数据库迁移。
- Nginx 反向代理模板。
- 初始化口令和 DeepSeek 配置说明。
- 自动备份 cron 模板。
- 部署、升级、回滚和恢复文档。

单容器监听内部端口，由宿主机 Nginx 提供 HTTPS。应用支持环境变量 `APP_BASE_PATH=/giftmind-data/`，因此既能部署在子路径，也能迁移到独立域名。

## 16. 测试

后端测试：

- 口令、会话、退出、限流和 CSRF。
- 礼物 CRUD、复制、软删除、恢复和彻底删除。
- 字段验证、完整度和冲突规则。
- 商品、图片和重复文件。
- DeepSeek 结构化输出、错误、超时和 Key 优先级。
- JSON、CSV、Excel 导入导出。
- 备份、校验、恢复和失败回滚。

前端测试：

- 分区表单、标准选项和自定义值。
- 本地草稿和离开提醒。
- AI 差异确认。
- 列表搜索、筛选和回收站。
- 图片上传状态。
- 导入预览和错误显示。

端到端流程：

1. 输入口令。
2. 新建礼物。
3. 调用模拟 DeepSeek。
4. 逐项接受建议。
5. 上传图片。
6. 保存并在列表找到。
7. 编辑、复制、删除和恢复。
8. 导出 JSON 和 Excel。
9. 导入一批含错误数据并验证未污染正式库。
10. 创建备份并在临时环境恢复。

自动测试不能消耗真实 DeepSeek 额度。

## 17. 验收标准

项目完成必须同时满足：

- 新同学无需说明文档即可在 10 分钟内录入第一条完整礼物。
- AI 建议永远不会未经确认写入数据库。
- 断开 DeepSeek 后仍可完成全部人工采集和导出工作。
- 重复名称、非法价格、字段冲突和无效商品链接会被明确拦截或提示。
- SQLite、图片和设置能通过完整备份恢复。
- GiftMind JSON 可被现有礼物匹配器读取。
- 关键端到端流程零未处理前端错误。
- DeepSeek Key、团队口令和服务器路径不会出现在前端资源、导出文件或普通日志中。
- 服务器重启和应用升级后数据、图片与设置保持不变。
