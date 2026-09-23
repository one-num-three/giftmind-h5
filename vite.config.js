import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// GiftMind H5 · Vite 配置
// 设计稿基准宽度 375px，px 会由 postcss-pxtorem 自动转 rem（见 postcss.config.js）
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isSingle = process.env.SINGLE === '1'

  return {
    base: env.VITE_PUBLIC_BASE || './',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5175,
      proxy: {
        '/deepseek-proxy': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/deepseek-proxy/, ''),
          headers: {
            ...(process.env.DEEPSEEK_API_KEY ? { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` } : {}),
          },
        },
        '/mimo-proxy': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/mimo-proxy/, ''),
          headers: {
            ...(process.env.DEEPSEEK_API_KEY ? { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` } : {}),
          },
        },
        '/jev-proxy': {
          target: 'https://api.typesafe.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/jev-proxy/, ''),
          headers: {
            ...(process.env.JEV_API_KEY ? { Authorization: `Bearer ${process.env.JEV_API_KEY}` } : {}),
          },
        },
        // 真实后端联调时打开：把 /api 代理到网关，避免跨域
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'es2018',
      // SINGLE=1 时打成「单文件预览版」：不分包、不拆 CSS，配合 scripts/inline.mjs
      // 产出一个可以直接双击打开的 giftmind-demo.html
      cssCodeSplit: !isSingle,
      chunkSizeWarningLimit: 2000,
      outDir: isSingle ? 'dist-single' : 'dist',
      rollupOptions: {
        output: isSingle
          ? { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app.[ext]' }
          : { manualChunks: { vendor: ['vue', 'vue-router', 'pinia'] } },
      },
    },
  }
})
