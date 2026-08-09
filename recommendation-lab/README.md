# GiftMind 推荐命中测试台

这是一个完全独立的 Vue 3 + Vite 小站，用来验证“用户描述 → 候选礼物 → 明确选中 → 反馈”的推荐链路，不依赖主 H5 的页面代码。

## 启动

先启动 GiftMind 后端，确保它监听 `http://127.0.0.1:8000`，然后在本目录运行：

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5175`。开发服务器会把 `/api` 代理到本地后端。

## 验证

```bash
npm run test
npm run build
```

## 接口

- `POST /api/h5/recommendation-lab/evaluate`：提交送礼条件并获得带评分候选。
- `POST /api/h5/recommendation-lab/feedback`：保存用户明确选中的礼物和反馈。

滑动卡片只用于浏览，不会记录为喜欢或拒绝。只有点击“选中这个礼物”才会进入反馈阶段。
