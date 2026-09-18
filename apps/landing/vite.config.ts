import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * 分享访客落地页构建配置(ADR-4:产物拷进 Go 二进制,由 /s/ 提供)。
 *
 * 与 admin 同款的三条约束:
 * 1. **`base: "/s/"`** —— 前端挂在子路径。/s 由 Go 的 embed 提供,用默认 `/`
 *    会让资源指向 `/assets/...` 而 404。
 * 2. **`outDir: "dist"`** —— scripts/copy-dist.mjs 把 `apps/landing/dist` 拷到
 *    `Server-com/internal/webui/dist/landing`;目录名不能变,否则 go:embed 找不到。
 * 3. **公开面关闭 sourcemap** —— 落地页是外部匿名面,不应把源码打进发布物。
 */
export default defineConfig({
  base: "/s/",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2021",
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8080",
    },
  },
});
