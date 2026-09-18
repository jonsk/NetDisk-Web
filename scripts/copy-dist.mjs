/**
 * 把 web-com 各前端 app 的构建产物拷进 Server-com 的 embed 目录。
 *
 * ADR-4 规定:web/ 源码留在顶层,产物拷入 Server-com/internal/webui/dist/<site>/ 后
 * 由 `//go:embed all:dist` 编译进 Go 二进制。本脚本是"build → copy → go build"
 * 这一**单一门禁**的 copy 环节 —— 改了前端不重编二进制 = 静默错版,所以必须走这里。
 *
 * 用法:pnpm copy-dist   (或 pnpm build:all)
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Server-com 与 web-com 同级(均在 D:/WorkSpace/GO 下)
const serverDist = resolve(root, "../Server-com/internal/webui/dist");

// 需要拷贝的站点(目录名必须与 Go 侧 webui.Handler 的 site 参数一致)
const sites = ["admin", "landing"];

let ok = true;
for (const site of sites) {
  const src = resolve(root, `apps/${site}/dist`);
  if (!existsSync(src)) {
    console.warn(`[copy-dist] 跳过 ${site}:${src} 不存在(先 pnpm build?)`);
    ok = false;
    continue;
  }
  const dst = resolve(serverDist, site);
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log(`[copy-dist] ${site} -> ${dst}`);
}

if (!ok) {
  console.error("[copy-dist] 部分站点未拷贝(见上面的警告)。");
  process.exit(1);
}
console.log("[copy-dist] 完成。下一步:在 Server-com 执行 go build。");
