// 移动端适配：设计稿 375px 基准，1rem = 37.5px
// 配合 src/utils/flexible.js 动态设置 html 根字号，实现整体等比缩放 + 桌面端最大宽度收口
export default {
  plugins: {
    'postcss-pxtorem': {
      rootValue: 37.5,
      unitPrecision: 5,
      propList: ['*'],
      selectorBlackList: [/^\.no-rem/, /^html$/],
      minPixelValue: 2,
      mediaQuery: false,
      exclude: /node_modules/,
    },
  },
}
