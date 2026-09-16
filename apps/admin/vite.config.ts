import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * 管理后台构建配置(ADR-4:产物拷进 Go 二进制,由 /admin/ 提供)。
 *
 * 三条与部署方式绑定的设置:
 *
 * 1. **`base: "/admin/"`** —— 前端挂在子路径。/admin 由 Go 的 embed 提供,
 *    若用默认的 `/`,index.html 里的资源会指向 `/assets/...` 而 404
 *    (表现为白屏 + 控制台一堆 404,而服务端日志只有几条静态文件请求)。
 * 2. **`outDir: "dist"`** —— scripts/gen 把 `web/apps/admin/dist` 拷到
 *    `server/internal/webui/dist/admin`;目录名不能变,否则 go:embed 找不到。
 * 3. **sourcemap 只在非生产开启** —— 生产 sourcemap 会把源码打进发布物,
 *    而管理后台的源码里含接口路径与内部字段名。
 */
export default defineConfig(({ mode }) => ({
  base: "/admin/",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: mode !== "production",
    // 目标定在 es2021:Go 侧不做转译,浏览器下限由这里决定(企微/钉钉内置
    // WebView 的 Chromium 版本较老;管理后台虽然主要在桌面浏览器,统一目标更省心)
    target: "es2021",
    rollupOptions: {
      output: {
        // 带内容哈希的文件名是**长缓存的前提**(R-02:assets/* immutable,
        // index.html no-cache)。没有哈希就只能给静态资源设短缓存,
        // 于是每次发版用户的第一次访问都要重下所有资源。
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 5174,
    // 开发期直连本机服务端:Vite 只服务前端,API 由 Go 提供(与生产同源形态)
    proxy: {
      "/api": "http://127.0.0.1:8080",
    },
  },
}));
