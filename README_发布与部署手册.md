# 🎁 GiftMind 智能送礼策划平台（正式可发布生产包）

> **版本**：v1.0.0 正式发布版  
> **打包时间**：2026-08-31  
> **核心引擎**：Xiaomi MiMo 标准经济模型（`mimo-v2.5`）与 DeepSeek 双引擎支持  
> **商品数据**：直连 `giftmind-data-studio` 官方 164 款真实好物与体验数据库（`officialGifts.json`）  
> **选品机制**：RAG 多维语义候选池检索 + AI 选品大脑（100% 从官方商品库中挑选真实方案，绝不捏造或错位）  
> **交互亮点**：深度 5 步见招拆招动态追问、全问题支持「✍️ 自定义输入」、流式打字机高情商即时点评（⚡极速 / ☕沉浸自由切换）

---

## 📂 目录结构说明

```text
GiftMind_正式发布版/
├── dist/                               # 【生产编译成品】已优化压缩的 Web 应用（HTML/CSS/JS），直接用于部署
│   ├── index.html                      # 单页应用主入口
│   └── assets/                         # 打包后的 JS、CSS 与静态资源
├── src/                                # 【完整项目源码】Vue 3 + Pinia + Vite + GSAP
│   ├── api/
│   │   ├── catalogService.js           # 官方商品库多维检索与 RAG 候选池注入
│   │   ├── aiQuestionEngine.js         # 5 步深度 AI 动态出题引擎（纯中文、见招拆招）
│   │   ├── mimoService.js              # 大模型接口（多样化点评、官方精准选品、书信定制）
│   │   └── localKnowledgeBase.js       # 本地专家知识库
│   ├── data/
│   │   └── officialGifts.json          # 官方 164 款精选商品与线下体验数据库
│   ├── components/                     # 气泡打字机、选项面板（含自定义输入）、礼物卡片、书信卡片
│   ├── composables/                    # 对话流调度器（useChatFlow.js）
│   ├── stores/                         # Pinia 响应式状态管理（session.js, plan.js 等）
│   └── views/                          # 对话流、加载页、方案结果页（纯净交付版）
├── 【一键运行】本地生产版预览.bat          # 双击即可在本地快速启动并预览生产包（端口 8080/5173）
├── 【一键运行】开发调试模式.bat            # 双击即可启动 Vite 实时热重载开发服务器
├── package.json                        # 依赖包配置文件
├── vite.config.js                      # Vite 构建与路径别名配置
└── README_发布与部署手册.md              # 本说明文档
```

---

## 🚀 快速使用与部署指南

### 方法 1：Windows 本地双击直接运行（最简单）

1. **直接预览编译后的生产版**：
   * 双击文件夹中的 **`【一键运行】本地生产版预览.bat`**；
   * 浏览器将自动打开 `http://127.0.0.1:8080/` 即可直接体验！

2. **开发与源码调试**：
   * 双击文件夹中的 **`【一键运行】开发调试模式.bat`**；
   * 自动安装依赖并启动 Vite 热重载服务器 `http://127.0.0.1:5173/`。

---

### 方法 2：生产服务器部署（Nginx 静态托管）

将 `dist/` 文件夹上传至服务器目录（如 `/var/www/giftmind/dist`），在 Nginx 配置文件中添加：

```nginx
server {
    listen 80;
    server_name giftmind.yourdomain.com; # 替换为你的域名或服务器IP

    root /var/www/giftmind/dist;
    index index.html;

    # 单页应用路由兜底
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 启用 Gzip 极速压缩
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
```

---

### 方法 3：一键部署到 Vercel / Netlify / Cloudflare Pages

1. 将本文件夹上传至 GitHub 仓库；
2. 在 **Vercel / Netlify** 中导入该仓库：
   * **Framework Preset**：`Vite`
   * **Build Command**：`npm run build`
   * **Output Directory**：`dist`
3. 点击 **Deploy**，1 分钟内即可获得全球可访问的 HTTPS 域名！

---

## 💡 核心功能特性

1. **深度 5 步 AI 买手追问**：
   * 顺着用户的回答深入挖掘痛点（如送长辈深挖家务繁重/身体舒缓/精神念想；送孩子深挖科学探索/积木拼搭/艺术创想）；
   * **全题目均自带「✍️ 其他 / 自定义输入…」选项**，支持随时补充细节。
2. **0 延迟流式打字机即时懂行点评（Live Reaction）**：
   * 就事论事，杜绝模板套话，实装全局去重，绝不复读；
   * 支持右上角 **【⚡ 极速】** 与 **【☕ 沉浸】** 速率自由切换。
3. **真实 AI 选品大脑 + 官方 164 款商品库**：
   * 严格从 `data_cleaned.json` 官方商品库中挑选真实商品与真实价格，附送专属定制书信；
   * 方案页提供 **【一键复制完整方案】**，随时粘贴分享！
