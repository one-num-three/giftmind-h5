# GiftMind 数据工作台设计规格

- 日期：2026-07-27
- 状态：已完成方案确认，等待书面规格复核
- 产品名称：GiftMind Data Studio（GiftMind 数据工作台）
- 目标仓库：`one-num-three/giftmind-data-studio`
- 目标部署：用户自有 Ubuntu 服务器，现有 Nginx 反向代理

## 1. 背景

GiftMind 当前使用 `mock/giftLibrary.js` 中的静态礼物素材完成演示。现有记录已包含名称、分类、价格区间、适用人群、场合、性格标签、准备周期、禁忌、推荐理由和操作建议，但不具备多人连续采集、图片管理、数据校验、版本修订、导入导出、备份或真实商品渠道管理能力。

现有五个分类“实物、体验、定制、数字、组合”混合了四种不同概念：交付类型、载体形式、定制能力和组合结构。例如“定制电子歌单”既是数字商品又可定制，“陶艺双人课”是线下活动，“旅行加相册”则同时包含活动和商品。第一版数据工作台必须先纠正这个模型，否则活动地点、时长、参与人数等字段会与商品 SKU、材质、配送等字段混在一起，后续难以扩展。

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
11. 一级区分“商品型礼物”和“活动型礼物”，按类型显示不同字段和校验规则。
12. 建立字段注册、版本、废弃和迁移规范，让后续增加字段或礼物类型时不破坏历史数据。

## 3. 非目标

第一阶段明确不做：

- 个人账号、角色、组织、邀请、权限矩阵。
- 实时协同编辑和在线评论。
- 自动爬取电商网站、自动同步库存或自动下单。
- 支付、会员、订单和佣金系统。
- 面向消费者的 GiftMind 推荐页面。
- 向量数据库、知识图谱或复杂搜索集群。
- AI 自动提交、自动发布或自动覆盖人工字段。
- 任意拖拽布局式的动态表单设计器。第一版只提供受控的“自定义字段管理”，自定义字段统一显示在扩展信息区。
- 仅凭设置页面增加一个全新的一级礼物类型。新增一级类型需要按第 8 节的扩展规范补齐数据契约、表单、导入导出和测试。
- 对外公开 API。所有写入和 AI 接口都要求有效的团队会话。

## 4. 推荐架构

### 4.1 架构选择

采用独立项目，而不是把内部工具放进公开的 `giftmind-h5`：

- 前端：Vue 3、TypeScript、Vite、Pinia、Vue Router。
- 后端：FastAPI、Pydantic、SQLAlchemy、Alembic。
- 数据库：SQLite，开启 WAL、外键和定期完整性检查。
- 图片：服务器本地持久化目录，Pillow 转换 WebP。
- Excel：OpenPyXL。
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
- 首次部署通过服务器 `.env` 加载的环境变量 `TEAM_PASSCODE` 设置共用口令；该值不进入前端、日志、导出或 Git。
- 登录成功后签发有过期时间的 HttpOnly、SameSite=Strict 会话 Cookie。
- HTTPS 环境下 Cookie 必须启用 Secure。
- 会话固定有效期为 7 天。
- 所有修改、导入、导出、备份、设置和 AI 接口必须校验会话。
- 登出只清除当前浏览器 Cookie；本项目不维护服务器端会话撤销表。
- 需要修改口令时，在服务器 `.env` 更新 `TEAM_PASSCODE` 后重启容器。

### 5.2 必要的运行保护

- 接口限制请求体大小。
- 上传只接受 JPEG、PNG、WebP 和 HEIC 解码后的有效图片。
- 文件扩展名不能作为格式判断依据，必须解码验证。
- 随机生成存储文件名，禁止用户控制路径。
- 单图原始大小默认不超过 10 MB，每个礼物最多 8 张图片。
- 所有数据访问使用参数化查询。
- 应用不把 DeepSeek Key、团队口令哈希或服务器路径写入日志。

### 5.3 HTTPS 要求

应用本身保持主机名无关。正式供外部网络访问前，Nginx 必须启用 HTTPS。DeepSeek Key 只由服务器 `.env` 提供，网页没有保存或编辑 Key 的入口。

## 6. 页面与交互

### 6.1 口令页

- 单一口令输入框。
- 显示应用名称和简短用途。
- 支持回车提交、显示/隐藏口令和错误提示。
- 不显示用户名、注册、找回密码或成员管理。

### 6.2 数据概览

显示：

- 礼物概念总数、完整记录数、草稿数、待补充数、停用数。
- 商品型与活动型礼物数量，以及各自有具体商品渠道或活动提供方的记录数。
- 缺图片、缺来源、长期未核验和疑似重复的记录数。
- 交付类型、载体、场合、收礼人和预算区间的覆盖情况。
- 最近修改记录。
- “新增礼物”“批量导入”“导出数据”三个主要入口。

### 6.3 礼物数据库列表

- 支持名称、别名、商家、品牌、标签和备注的统一搜索。
- 支持按状态、一级类型、商品载体、活动模式、是否定制、是否组合、收礼人、场合、价格、准备周期、图片、具体渠道、完整度和核验日期筛选。
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
2. 类型确认：商品型或活动型，以及载体、活动模式、定制和组合属性。
3. 匹配维度。
4. 类型专属信息：商品信息或活动信息，只显示当前类型需要的字段。
5. 具体渠道：商品与商家，或活动提供方与场地。
6. 内容与质量。

功能要求：

- 自动保存浏览器本地草稿，但不自动写入服务器正式记录。
- 离开有未保存修改的页面时提示。
- “保存草稿”“保存并继续”“保存并录入下一条”。
- 新建时先做精确名称和模糊名称查重。
- 所有多选字段均有标准选项和“添加自定义值”。
- 自定义字段按适用范围显示在“扩展信息”区，不能绕过字段类型和校验规则。
- 切换一级类型时保留尚未保存的原类型字段，但保存前必须确认如何处理不再适用的数据。
- 复制记录时自动生成新 ID，并清除商品库存、活动场次和渠道核验时间。

### 6.5 回收站

- 显示删除时间、原名称和删除前状态。
- 支持恢复和彻底删除。
- 彻底删除前二次确认，并说明关联商品和图片也会删除。
- 自动清理关闭，除非用户在设置中明确开启。

### 6.6 导入导出

- 提供 JSON、CSV、Excel 和完整备份。
- 提供空白 Excel 模板和带示例的模板。
- Excel 使用 `礼物基础`、`商品详情`、`活动详情`、`商品渠道`、`活动渠道`、`组合组件`、`自定义字段值`、`图片清单`、`数据字典` 九个工作表。
- 导入先上传、解析、预览和校验，用户确认后才写入。
- 错误按工作表、行号、字段和原因展示，并可下载错误报告。
- 支持精确名称、别名和稳定 ID 的重复策略：跳过、更新、复制为新记录。
- 单次导入在数据库事务中完成；发生未处理错误时整批回滚。
- JSON 导出提供“完整内部格式”和“GiftMind 消费格式”。
- 完整备份为 ZIP，包含数据库、图片、设置清单和版本信息，但不包含团队口令明文和 DeepSeek Key。

### 6.7 系统设置

- DeepSeek 连接状态、模型、Base URL、超时和重试状态；这些值由服务器 `.env` 配置，网页只读展示。
- 数据字典管理：新增、停用、排序自定义选项；内置核心值不可删除，只能停用。
- 自定义字段管理：设置机器键、中文名称、适用类型、数据类型、是否多值、帮助文案、校验、AI 策略和显示顺序。
- 已产生数据的自定义字段不能直接删除，只能停用或进入废弃流程。
- 图片限制。
- 手动备份、备份列表和恢复入口。

## 7. 分类模型与数据字段

### 7.1 分类原则

第一版不再用一个 `category` 同时表达不同概念，而是拆成四个互相独立的轴：

1. `gift_type_code`：一级交付类型，第一版内置 `product`（商品型）和 `activity`（活动型）。
2. `product_form` 或 `activity_mode`：商品为 `physical`、`digital` 或 `hybrid`；活动为 `offline`、`online` 或 `hybrid`。
3. `is_customizable`：是否支持个性化定制。
4. `is_bundle`：是否由多个商品或活动组合而成。

示例：

- 黄铜刻字书签：`product + physical + customizable`。
- 定制电子歌单：`product + digital + customizable`。
- 陶艺双人课：`activity + offline`。
- 在线绘画课：`activity + online`。
- 周末礼物包：`product + bundle`。
- 短途旅行加纪念相册：`activity + bundle`，以旅行体验为主要交付类型，组件同时包含活动和商品。

组合不是第三种一级类型。组合礼物仍须按核心交付内容选择一个主要类型，其组成差异由组件关系完整保留。数据库不使用不可扩展的数据库枚举保存一级类型。`gift_type_code` 使用稳定字符串并关联 `gift_type_definitions`，但新增一级类型仍须遵守第 8.4 节的类型扩展流程。

### 7.2 礼物基础 `gifts`

身份和状态：

- `id`：UUID。
- `schema_version`：该记录最后通过的数据契约版本。
- `gift_type_code`：`product` 或 `activity`，必填。
- `canonical_name`：标准名称，必填。
- `aliases`：别名数组。
- `short_description`：简短描述。
- `subcategory_code`：当前一级类型下的标准子类或自定义值。
- `is_customizable`、`is_bundle`。
- `status`：draft、needs_review、complete、inactive。
- `emoji`：可选。
- `completeness_score`：服务端按类型计算，0–100。

共用匹配维度：

- `recipient_types`：伴侣、父母、朋友、同事、孩子等。
- `relationship_stages`：初识、稳定关系、长期关系、正式职场等。
- `age_ranges`：婴幼儿、儿童、青少年、青年、中年、老年等。
- `traits`：文艺、居家、运动、极简、甜食、户外、时尚、影音、美食、数码等。
- `interests`：可扩展多选。
- `occasions`：生日、纪念日、节日、毕业/里程碑、道歉/和好、无理由等。
- `desired_feelings`：被理解、惊喜、甜蜜、温暖、开心等。
- `memory_hooks`：适合承接的故事或记忆线索。
- `tags`：标准标签。
- `custom_tags`：采集者新增标签。

共用预算和准备字段：

- `price_min`、`price_max`：礼物概念的常见总预算，非负整数或两位小数。
- `is_free`：明确标记免费商品或免费活动。
- `currency`：默认 CNY。
- `lead_days_min`、`lead_days_max`：通常需要提前准备的天数。
- `rush_available`：是否存在加急可能，不代表某个渠道实时可用。

共用风险、内容和质量字段：

- `taboo_flags`：价格负担、占地方、香味、食物、一次性、张扬等。
- `allergy_notes`、`safety_notes`、`unsuitable_groups`。
- `why_template`：推荐理由素材。
- `best_scenarios`、`unsuitable_scenarios`。
- `purchase_or_booking_tip`、`ritual_tip`、`pairing_ideas`。
- `collector_notes`。
- `source_notes`、`source_urls`。
- `confidence_level`：low、medium、high。
- `verified_at`。
- `created_at`、`updated_at`、`deleted_at`。

### 7.3 商品详情 `product_details`

每条商品型礼物必须有且仅有一条商品详情：

- `gift_id`：一对一主键和外键。
- `product_form`：physical、digital、hybrid。
- `generic_product_name`：不带商家的通用商品名。
- `materials`、`colors`、`sizes`、`specifications`、`variant_notes`。
- `weight_grams`、`package_dimensions`。
- `size_class`：无实体、小件、中件、大件。
- `is_bulky`、`is_fragile`、`is_consumable`。
- `shelf_life_days`、`storage_requirements`。
- `personalization_methods`、`personalization_requirements`。
- `device_or_platform_compatibility`：数字商品或数码商品适用。
- `digital_delivery_method`：下载、兑换码、账号权益等。
- `shipping_required`、`shipping_notes`。
- `return_risk_notes`、`warranty_expectation`。

### 7.4 商品渠道 `product_offers`

一条商品型礼物可关联 0 到多个可购买渠道：

- `id`、`gift_id`。
- `merchant`、`brand`、`offer_name`、`sku_or_model`。
- `current_price`、`currency`。
- `stock_status`：unknown、available、limited、unavailable。
- `ship_from`、`service_regions`、`delivery_days`、`shipping_cost`。
- `purchase_url`。
- `return_policy`、`warranty_policy`。
- `source_url`、`verified_at`。
- `active`、`created_at`、`updated_at`。

渠道字段表达可核验事实，不能从礼物概念的估算预算自动反推。

### 7.5 活动详情 `activity_details`

每条活动型礼物必须有且仅有一条活动详情：

- `gift_id`：一对一主键和外键。
- `activity_mode`：offline、online、hybrid。
- `activity_category`：课程、演出、餐饮、旅行、运动、疗愈、娱乐、公益等。
- `service_regions`：概念通常可开展的城市、地区或“全国线上”等范围。
- `duration_minutes_min`、`duration_minutes_max`。
- `participants_min`、`participants_max`。
- `pricing_unit`：per_person、per_group、per_session、free。
- `schedule_type`：fixed、flexible、recurring、on_request。
- `booking_required`、`booking_lead_days_min`、`booking_lead_days_max`。
- `validity_days`：票券或预约权益的有效期。
- `included_items`、`excluded_items`、`equipment_requirements`。
- `age_restrictions`、`height_restrictions`、`health_restrictions`。
- `accessibility_notes`。
- `weather_dependency`、`indoor_outdoor`。
- `cancellation_expectation`、`reschedule_expectation`、`refund_expectation`。

### 7.6 活动渠道 `activity_offers`

一条活动型礼物可关联 0 到多个提供方或场地：

- `id`、`gift_id`。
- `provider_name`、`offer_name`。
- `city`、`venue_name`、`address`、`longitude`、`latitude`。
- `service_regions`。
- `current_price_min`、`current_price_max`、`currency`、`pricing_unit`。
- `opening_hours_or_schedule_notes`、`availability_status`。
- `booking_url`、`booking_contact`。
- `cancellation_policy`、`reschedule_policy`、`refund_policy`。
- `source_url`、`verified_at`。
- `active`、`created_at`、`updated_at`。

第一版记录场次说明和可用状态，不做实时排期、票务库存同步或自动预约。

### 7.7 组合组件 `gift_bundle_components`

组合礼物使用显式组件关系，不把组成内容塞进一段备注：

- `id`、`bundle_gift_id`。
- `component_gift_id`：引用库中已有礼物时填写。
- `component_type_code`、`component_name`：组件尚未独立建档时填写。
- `quantity`、`required`、`display_order`。
- `role_notes`：说明该组件在整体礼物中的作用。

`bundle_gift_id` 不能直接或间接引用自己。组合可同时包含商品和活动。

### 7.8 图片 `gift_images`

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

### 7.9 字段定义与辅助表

- `gift_type_definitions`：一级类型代码、名称、状态和契约版本。第一版内置 product、activity。
- `dimension_options`：标准和自定义数据字典。
- `custom_field_definitions`：自定义字段的机器键、名称、范围、类型、校验、AI 策略、状态和版本。
- `gift_custom_field_values`：按礼物和字段定义保存经过校验的扩展值，值使用 JSON 表达但由字段定义约束。
- `settings`：非敏感的界面与数据维护设置；不保存 DeepSeek Key 或团队口令。
- `ai_runs`：模型、耗时、成功状态、Token 用量、错误类型，不保存明文 Key。
- `audit_events`：创建、修改、复制、删除、恢复、导入、导出、设置和备份事件。
- `imports`：导入文件、统计和错误报告。
- `backups`：备份文件、大小、校验值和创建时间。

礼物详情 API 使用带 `gift_type_code` 判别字段的联合结构：共用字段始终存在，`product` 只接受 `product_details`，`activity` 只接受 `activity_details`。错误类型的专属字段不能静默丢弃。

## 8. 字段与类型扩展规范

### 8.1 三层字段模型

字段分为三层，新增需求先判断放在哪一层：

1. **数据字典选项**：只是为已有多选或单选增加一个值，例如新增兴趣或活动子类。写入 `dimension_options`，不改数据库结构。
2. **受控自定义字段**：尚在试验、使用频率较低或只适用于少数数据的字段。写入 `custom_field_definitions`，由通用控件渲染。
3. **核心字段**：高频检索、参与推荐计算、需要跨字段校验、需要稳定导出或已被大量记录采用的字段。通过 Alembic 迁移进入 `gifts` 或类型详情表。

不能为了省事把所有新字段永久放在 JSON 中，也不能为每个临时想法都增加数据库列。

### 8.2 每个字段必须具备的定义

新增字段必须填写并进入版本控制：

- 不可变机器键：小写 `snake_case`，一旦产生数据不得改名复用。
- 中文名称和一句话定义。
- 适用范围：common、product、activity 或未来类型代码。
- 数据类型：text、long_text、integer、decimal、currency、boolean、date、url、single_choice、multi_choice。
- 基数：单值或多值；数值字段同时注明单位和精度。
- 是否必填：never、draft_optional、complete_required。
- 帮助文案、一个正例和一个反例。
- 默认值规则；未知值必须使用空值，不得用 `0`、`其他` 或空字符串冒充。
- 校验规则和与其他字段的冲突规则。
- 数据来源要求：人工判断、来源链接、现场核验或系统计算。
- AI 策略：prohibited、suggest、infer_with_confirmation。
- 是否包含敏感信息。第一版禁止创建收集个人隐私的自定义字段。
- 搜索、筛选、排序和完整度权重要求。
- 内部 JSON、Excel、CSV 和 GiftMind 消费格式的映射。
- 引入版本、负责人、状态和废弃替代字段。

### 8.3 字段生命周期

字段状态依次为 `draft → active → deprecated → retired`：

- draft：只在测试环境或扩展信息区试用，不影响完整度。
- active：可正式采集，定义和校验已稳定。
- deprecated：保留历史读取，停止新数据录入，并显示替代字段。
- retired：仅备份和历史导出可见，普通页面隐藏。

已产生数据的字段禁止物理删除。改名只能修改中文显示名，机器键不变。改变数据类型必须新建字段、提供转换脚本、保留回滚路径并记录迁移报告。

受控自定义字段满足任一条件时应升级为核心字段：进入推荐或排序逻辑、需要跨字段校验、需要专用控件、需要数据库索引、进入 GiftMind 稳定导出契约，或连续两轮采集中被广泛使用。升级流程必须包含数据库迁移、数据回填、双读校验、导入导出更新和测试。

### 8.4 新增一级礼物类型

新增一级类型不是增加一个下拉选项。每个新类型必须提交一份短规格，至少包含：

1. 类型代码、定义、正例、反例和与现有类型的边界。
2. 专属字段、必填规则、完整度权重和事实核验要求。
3. 表单分区、列表摘要、筛选项和复制行为。
4. AI 分类提示词、结构化输出 Schema 和禁止推断字段。
5. JSON、CSV、Excel、备份和 GiftMind 消费格式映射。
6. 从旧数据迁移或重新分类的规则。
7. 后端校验、前端交互、导入导出和端到端测试。

实现方式优先增加独立的一对一详情表和对应服务模块，不向 `gifts` 堆叠大量可空字段。只有确认边界、迁移和测试后，才在 `gift_type_definitions` 激活新类型。

### 8.5 版本与兼容性

- 数据契约使用递增整数 `schema_version`。
- 每次核心字段、枚举语义或类型结构变化都增加版本并提供 Alembic 迁移。
- 导出文件在顶层写入 `schemaVersion`、`exportedAt` 和应用版本。
- 导入器至少兼容当前版本和前一个版本；更旧文件先执行显式转换。
- API 删除或改义字段前至少经历一个废弃版本。
- 未识别的未来字段不得丢失；完整内部 JSON 导入导出要往返保留它们，并显示“当前版本未识别”警告。
- 每次扩展必须同步更新数据字典、示例模板、迁移说明和自动测试。
- 仓库必须交付并持续维护 `docs/DATA-SCHEMA-EXTENSION-GUIDE.md`，内容以本节为最低要求，并附带“新增一个字段”和“新增一个一级类型”的完整示例。

## 9. DeepSeek 自动补全

### 9.1 调用方式

采集者至少输入礼物名称，可以补充简短描述和人工已知信息，然后点击“AI 智能补全”。

服务端流程：

1. 校验团队会话。
2. 执行本地重复检查。
3. 首先请求 DeepSeek 判断 `product` 或 `activity`，同时返回置信度、判断理由和最多两个候选解释。
4. 前端要求采集者确认一级类型。像“手作对戒”这类既可能是购买成品、也可能是到店制作体验的名称，不能由 AI 静默决定。
5. 确认类型后，服务端只使用该类型的数据字典和结构化 Schema 请求第二阶段补全。
6. 调用 OpenAI 兼容的 DeepSeek API，并要求严格 JSON 输出。
7. 通过与一级类型对应的 Pydantic 模型校验，清理非法枚举、数值和错误类型字段。
8. 返回字段建议、逐字段置信度和依据，不写数据库。
9. 前端以差异视图显示建议。

默认配置：

- Base URL：`https://api.deepseek.com`。
- 模型：`deepseek-chat`。
- Temperature：0.2。
- 超时：45 秒。
- 网络或 5xx 错误重试 1 次。
- 分类和补全在一次按钮操作中编排；若一级类型已有人工确认，则跳过分类调用。
- 单次补全最多返回 24 个可建议字段。

### 9.2 AI 可以建议的字段

- 一级类型、商品载体或活动模式，以及是否定制、是否组合；全部需要人工确认。
- 当前类型的子分类。
- 收礼人、关系阶段、年龄段。
- 性格、兴趣、场合和期望情绪。
- 标准标签、自定义标签、记忆线索。
- 估算价格区间，并显式标记 `estimated`。
- 估算准备周期。
- 商品型可建议材质类别、体积、易碎、消耗品、定制方式、数字交付和兼容性等通用属性。
- 活动型可建议常见时长、参与人数、价格单位、预约需求、室内外、天气依赖和适用限制等通用属性。
- 禁忌、过敏和安全提醒。
- 推荐理由、适用和不适用场景。
- 购买、仪式和搭配建议。

AI 对估算字段必须返回 `confidence` 和 `reason`，不能把常识推测标成已核验事实。

### 9.3 AI 禁止建议为事实的字段

- 真实商家、品牌、SKU、活动提供方。
- 当前价格和库存。
- 购买链接、预约链接或联系方式。
- 真实配送地区、配送时效、活动城市、场地、地址、坐标、营业时间和可用场次。
- 退换、保修、取消、改期和退款政策。
- 来源链接和核验时间。
- 图片来源和使用权。
- 人工可信度。

AI 可以提示这些字段尚待人工核验，但不能编造值。

### 9.4 建议确认

- AI 新增值显示绿色。
- AI 修改人工值显示黄色，并同时展示原值和建议值。
- 冲突或低置信建议显示橙色。
- 支持逐字段接受、拒绝、编辑和接受全部。
- “接受全部”仍不会自动保存，必须点击保存。
- 每次建议保留运行摘要，便于排查质量和成本。

### 9.5 Key 管理

DeepSeek Key 只读取服务器 `.env` 加载的 `DEEPSEEK_API_KEY` 环境变量。前端只获得“已配置 / 未配置”和模型名称，不能保存、查看、下载或导出 Key。服务器 `APP_SECRET` 只用于签名团队会话 Cookie。

## 10. 数据质量规则

保存时必须执行：

- 标准名称不能为空，去除首尾空格后长度为 2–80 字。
- 一级类型必须是已启用类型；第一版只能保存 product 或 activity。
- 名称精确重复时阻止新建；高度相似时提示但允许确认后继续。
- 非免费礼物必须填写价格区间，且 `price_min <= price_max`。
- `is_free` 为真时不得同时填写大于零的价格。
- `lead_days_min <= lead_days_max`。
- 价格和周期不能为负数。
- 商品型记录必须有 `product_details`，且不能同时提交 `activity_details`。
- 活动型记录必须有 `activity_details`，且不能同时提交 `product_details`。
- 数字商品不能同时标记易碎、重量或必须物流配送。
- 活动时长和参与人数的最小值不得大于最大值。
- 线下活动标为完整时，至少要有服务地区说明；具体场地可在活动渠道中补充。
- 在线活动不能填写只适用于线下场地的地址和坐标。
- `is_bundle` 为真时，标为完整前至少需要两个有效组件。
- 组合关系必须无循环。
- 食物禁忌与食品类礼物冲突时阻止标为完整。
- 香味禁忌与香氛礼物冲突时阻止标为完整。
- 停用礼物不进入 GiftMind 消费格式导出。
- 所有完整状态都要求名称、一级类型、子类、价格或明确“免费”、准备周期、至少一个收礼人、场合、标签、推荐理由和来源说明。
- 商品型完整状态还要求商品载体，以及适用的交付或物流说明。
- 活动型完整状态还要求活动模式、时长、参与人数、价格单位和预约规则。
- 购买和预约 URL 必须是 HTTP 或 HTTPS。
- 商品渠道或活动渠道核验超过 90 天时显示过期提醒。
- 自定义字段值必须通过其当前字段定义校验；字段停用后只读保留旧值。

完整度由服务端按“共用权重 + 当前类型权重 + 组合权重”计算，前端不自行计算。AI 建议未被人工接受前不计入完整度。

## 11. API 边界

主要接口：

```text
POST   /api/session/login
POST   /api/session/logout
GET    /api/session

GET    /api/dashboard
GET    /api/gift-types
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
GET    /api/field-definitions
POST   /api/field-definitions
PUT    /api/field-definitions/{id}
POST   /api/field-definitions/{id}/deprecate

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

礼物新增和更新请求使用 `gift_type_code` 判别联合结构。后端必须拒绝类型与详情结构不匹配的请求，并在响应中返回标准化后的完整记录及其 `schema_version`。

## 12. 导出到 GiftMind

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

导出层负责把新模型映射为 GiftMind 当前五分类，不要求前端消费者立即改造。兼容映射顺序固定为：

1. `is_bundle = true` → `组合`。
2. 非组合且 `is_customizable = true` → `定制`。
3. 非组合、非定制且 `gift_type_code = activity` → `体验`。
4. 非组合、非定制的数字商品 → `数字`。
5. 其余商品 → `实物`。

这只是兼容旧 H5 的降维导出，内部数据仍保留完整的商品/活动、载体、定制和组合信息。导出测试必须覆盖同一条记录同时具有多个属性时的优先级。

## 13. 备份与恢复

- 提供应用内手动备份。
- 服务器每天 02:30 通过 cron 调用备份命令。
- 默认保留最近 30 天自动备份。
- 每个备份生成 SHA-256 校验值。
- 备份前执行 SQLite checkpoint 和完整性检查。
- 恢复前自动生成一次“恢复前备份”。
- 恢复流程验证版本、校验值和文件结构。
- 恢复失败时保持原数据库和图片不变。

## 14. 错误处理

- AI 不可用时保留所有人工录入功能。
- AI 超时显示可重试提示，不清空表单。
- AI 无法确定商品或活动时显示并列候选，要求人工选择后再继续。
- 网络断开时持续保留浏览器草稿。
- 图片部分失败时成功图片保留，失败图片逐张显示原因。
- 保存使用幂等请求 ID，避免双击产生重复记录。
- 导入解析错误不写数据库。
- 磁盘剩余空间不足时禁止图片上传和备份，并显示明确告警。
- 所有用户可恢复错误使用中文说明，日志保留技术细节。

## 15. 视觉设计

采用已经确认的 B 方案：

- 桌面优先，适配平板和手机。
- 奶油白背景、深森林绿主色、低饱和金色强调。
- 强调信息密度和清晰层级，不使用装饰性大图。
- 标准控件包括搜索框、筛选 Chips、多选下拉、标签输入、数值区间、日期、图片上传、差异确认、完整度和错误列表。
- 一级类型使用醒目的“商品 / 活动”二选一；确认后表单平滑切换为商品或活动专属分区，当前选择始终可见。
- 商品专属字段使用包裹图标和商品色标，活动专属字段使用日历图标和活动色标；颜色只作辅助，字段标题同时显示文字类型。
- 自定义字段统一放在“扩展信息”分区，并显示字段定义中的帮助文案和单位。
- 主按钮始终使用明确动作词，如“AI 智能补全”“保存并录入下一条”。
- AI 建议、人工值、错误和缺失状态必须同时依靠文字与颜色区分。
- 键盘可完成主要录入流程，表单有清晰焦点状态和无障碍标签。

## 16. 部署

交付物：

- Dockerfile 和 Docker Compose。
- `.env.example`。
- 数据库迁移。
- 字段与类型扩展指南 `docs/DATA-SCHEMA-EXTENSION-GUIDE.md`。
- Nginx 反向代理模板。
- 初始化口令和 DeepSeek 配置说明。
- 自动备份 cron 模板。
- 部署、升级、回滚和恢复文档。

单容器监听内部端口，由宿主机 Nginx 提供 HTTPS。应用支持环境变量 `APP_BASE_PATH=/giftmind-data/`，因此既能部署在子路径，也能迁移到独立域名。

## 17. 测试

后端测试：

- 口令、会话、退出、7 天过期和受保护接口拒绝未登录访问。
- 礼物 CRUD、复制、软删除、恢复和彻底删除。
- 商品/活动判别联合结构和错误类型字段拒绝。
- 商品字段、活动字段、组合关系、完整度和跨字段冲突规则。
- 商品渠道、活动渠道、图片和重复文件。
- 自定义字段定义、类型校验、停用、废弃和核心字段迁移。
- `schema_version` 迁移、前一版本导入和未知未来字段往返保留。
- DeepSeek 结构化输出、错误、超时和仅环境变量 Key 配置。
- JSON、CSV、Excel 导入导出。
- 备份、校验、恢复和失败回滚。

前端测试：

- 商品/活动类型确认、条件分区切换和切换时的数据处理确认。
- 分区表单、标准选项、自定义值和扩展字段。
- 本地草稿和离开提醒。
- AI 差异确认。
- 列表搜索、筛选和回收站。
- 图片上传状态。
- 导入预览和错误显示。

端到端流程：

1. 输入口令。
2. 新建一条商品型礼物并确认商品专属字段。
3. 新建一条活动型礼物并确认活动专属字段。
4. 用含歧义的名称调用模拟 DeepSeek，人工选择类型后逐项接受建议。
5. 创建包含商品和活动的组合礼物，并验证循环引用被拒绝。
6. 上传图片。
7. 保存并在列表按类型找到。
8. 编辑、复制、删除和恢复。
9. 创建、使用并停用一个自定义字段。
10. 导出 JSON 和九工作表 Excel，并验证旧 GiftMind 五分类兼容映射。
11. 导入一批含错误数据并验证未污染正式库。
12. 创建备份并在临时环境恢复。

自动测试不能消耗真实 DeepSeek 额度。

## 18. 验收标准

项目完成必须同时满足：

- 新同学无需说明文档即可在 10 分钟内录入第一条完整礼物。
- 采集者选择商品或活动后，只看到适用字段；两类数据不会互相污染。
- 商品、活动、定制、数字和组合可以同时准确表达，并能兼容导出到现有五分类。
- AI 建议永远不会未经确认写入数据库。
- 断开 DeepSeek 后仍可完成全部人工采集和导出工作。
- 重复名称、非法价格、字段冲突和无效商品链接会被明确拦截或提示。
- SQLite、图片和设置能通过完整备份恢复。
- GiftMind JSON 可被现有礼物匹配器读取。
- 新增数据字典值和受控自定义字段不需要修改核心表；新增核心字段或一级类型有明确版本、迁移、兼容和测试流程。
- 已停用或废弃字段的历史值不会因升级或导入导出丢失。
- 关键端到端流程零未处理前端错误。
- DeepSeek Key、团队口令和服务器路径不会出现在前端资源、导出文件或普通日志中。
- 服务器重启和应用升级后数据、图片与设置保持不变。
