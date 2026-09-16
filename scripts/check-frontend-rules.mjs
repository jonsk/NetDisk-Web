#!/usr/bin/env node
/**
 * 前端纪律静态检查(FE-W-03 起;随社区版移除 H5 工作台后收缩为 admin 专用)。
 *
 * # 为什么需要它
 *
 * 前端这一侧**没有测试运行器**(一期不引 vitest/playwright:为一个后台引一套
 * 浏览器测试栈的成本远超收益)。而"验收标准必须可自动验证"是硬要求 ——
 * 于是把**能被文本判定**的纪律做成门禁,和桌面端的 NameRulesCheck / LoopbackLoginCheck
 * 同一种做法:零依赖、可直接在 CI 跑、每条规则都必须能"破坏即红"。
 *
 * 它**不能**替代人工验收(交互、样式、真机),所以每条规则只钉那些
 * "写错了不会报错、只会静默做错事"的地方:
 *
 *   R1 admin 登录必须 audience=web(R-14 分端)
 *      —— 写错的表现是"登录成功但所有接口 403",而错误信息只说"令牌无效"
 *   R2 管理后台令牌只存 sessionStorage(不得用 localStorage)
 *      —— localStorage 在共用电脑上长期留存管理凭据
 *   R3 路由守卫:未登录跳登录页,且**保留原地址**(redirect 查询参数)
 *      —— 不保留的话用户每次登录后都被送回首页,丢掉他本来要打开的页面
 *   R4 token 过期**静默刷新并重放一次**(客户端 send():401 → onUnauthorized → 重放)
 *      —— 只刷新不重放等于"刷新了但这次请求还是失败"
 *   R5 入口先把会话从本地恢复、再挂路由
 *      —— 顺序反了会让刷新页面时守卫看到"未登录",每次刷新被弹回登录页
 *   R6 受保护 API 不得用 <a href>/window.open 直接打开
 *      —— 不带令牌会 401;把令牌塞进 URL 会写进浏览器历史与网关日志
 *   R7 管理后台不得直接使用平台 SDK 全局(wx/dd)
 *      —— 后台是纯 Web 页面,不应该依赖任一平台注入的全局对象
 *
 * 用法:node scripts/check-frontend-rules.mjs
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

const problems = [];
const checks = [];

function check(name, fn) {
  const before = problems.length;
  try {
    fn();
  } catch (err) {
    problems.push(`${name}: 检查器自身异常 ${err}`);
  }
  const ok = problems.length === before;
  checks.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}`);
}

function read(rel) {
  const full = path.join(webRoot, rel);
  if (!existsSync(full)) {
    return null;
  }
  return readFileSync(full, "utf8");
}

/**
 * stripComments 去掉注释后再做判定。
 *
 * **这是被实测逼出来的**:第一版直接扫全文,于是
 *   - `auth.ts` 的文档注释里写着"sessionStorage(不是 localStorage)"→ R2 误报;
 * 注释是给人看的,门禁只能认代码 —— 与 Go 侧 depsguard 的 R-14 是同一个坑。
 * 只删"整行/块注释",**不碰行内字符串**(否则 `https://` 会被当成注释截断)。
 */
function stripComments(text) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  const lines = out
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    });
  return lines.join("\n");
}

/** walk 递归列出源码文件(跳过 node_modules/dist)。 */
function walk(dir, out = []) {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") {
      continue;
    }
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

// ---- R1:分端受众 ----
check("R1 admin 登录带 audience=web", () => {
  const admin = stripComments(read("apps/admin/src/stores/auth.ts") ?? "");
  if (!admin) {
    problems.push("R1:找不到 apps/admin/src/stores/auth.ts");
  } else if (!/audience:\s*"web"/.test(admin)) {
    problems.push('R1:admin 登录未显式传 audience: "web"(写错的表现是"登录成功但接口全 403")');
  }
});

// ---- R2:管理后台令牌只存 sessionStorage ----
check("R2 admin 令牌只存 sessionStorage(禁用 localStorage)", () => {
  const files = walk(path.join(webRoot, "apps/admin/src"));
  for (const f of files) {
    const text = stripComments(readFileSync(f, "utf8"));
    if (/localStorage/.test(text)) {
      problems.push(
        `R2:${path.relative(webRoot, f)} 使用了 localStorage(管理后台令牌只允许 sessionStorage)`,
      );
    }
  }
  const auth = stripComments(read("apps/admin/src/stores/auth.ts") ?? "");
  if (auth && !/sessionStorage/.test(auth)) {
    problems.push("R2:admin 认证 store 未见 sessionStorage(令牌持久化策略缺失?)");
  }
});

// ---- R3:路由守卫保留原地址 ----
check("R3 未登录跳登录页且保留 redirect", () => {
  const router = stripComments(read("apps/admin/src/router/index.ts") ?? "");
  if (!router) {
    problems.push("R3:找不到 apps/admin/src/router/index.ts");
    return;
  }
  if (!/beforeEach/.test(router)) {
    problems.push("R3:路由没有 beforeEach 守卫(未登录不会跳登录)");
  }
  if (!/name:\s*"login"/.test(router)) {
    problems.push("R3:守卫未跳转到 login");
  }
  if (!/redirect:\s*to\.fullPath/.test(router)) {
    problems.push(
      "R3:守卫未把原地址放进 redirect(仅出现 redirect 字样不算 —— 路由表里的 redirect: \"/overview\" 不是这件事)",
    );
  }
  if (!/meta\.public/.test(router)) {
    problems.push("R3:未用 meta.public 标记公开路由(登录页自己也会被守卫拦住)");
  }
});

// ---- R4:401 静默刷新并重放 ----
check("R4 401 后静默刷新并重放一次请求", () => {
  const api = stripComments(read("packages/api/src/index.ts") ?? "");
  if (!api) {
    problems.push("R4:找不到 packages/api/src/index.ts");
    return;
  }
  if (!/onUnauthorized/.test(api)) {
    problems.push("R4:客户端未见 onUnauthorized(没有静默刷新入口)");
  }
  if (!/status === 401/.test(api)) {
    problems.push("R4:客户端未见 401 分支");
  }
  // 重放:401 分支之后必须再发一次同样的请求(doFetch 被调用两次)
  const m = api.match(/if \(res\.status === 401[\s\S]{0,400}?\n\s*}/);
  if (!m || !/doFetch\(\)/.test(m[0])) {
    problems.push("R4:401 分支未重放请求(只刷新不重放 = 这次请求仍然失败)");
  }
});

// ---- R5:入口顺序 ----
check("R5 入口先恢复会话再挂路由", () => {
  const main = stripComments(read("apps/admin/src/main.ts") ?? "");
  if (!main) {
    problems.push("R5:找不到 apps/admin/src/main.ts");
    return;
  }
  const restoreAt = main.indexOf("auth.restore()");
  const routerAt = main.indexOf("app.use(router)");
  if (restoreAt < 0) {
    problems.push("R5:入口未调用 auth.restore()(刷新页面会被弹回登录页)");
  } else if (routerAt < 0) {
    problems.push("R5:入口未挂载路由");
  } else if (restoreAt > routerAt) {
    problems.push("R5:auth.restore() 在 app.use(router) 之后 —— 首次导航会看到未登录");
  }
});

// ---- R6:受保护的 API 不得用 <a href>/window.open 直接打开 ----
check("R6 受保护接口必须经客户端调用(不得直接 href/window.open)", () => {
  const dirs = [path.join(webRoot, "apps/admin/src")];
  for (const dir of dirs) {
    for (const f of walk(dir)) {
      if (!/\.(ts|vue)$/.test(f)) {
        continue;
      }
      const text = stripComments(readFileSync(f, "utf8"));
      // `<a href="/api/...">` 与 `window.open("/api/...")` 都不会带 Authorization 头,
      // 结果是被保护接口回 401(而"把令牌塞进 URL"更是把凭据写进浏览器历史与网关日志)。
      const m = text.match(/(href\s*=\s*["'`]\/api\/|window\.open\(\s*["'`]\/api\/)/);
      if (m) {
        problems.push(
          `R6:${path.relative(webRoot, f)} 直接打开受保护接口「${m[1]}」—— 不带令牌(401),` +
            "而且把令牌放进 URL 会写进浏览器历史与网关日志",
        );
      }
    }
  }
});

// ---- R7:管理后台不得直接用平台 SDK 全局 ----
check("R7 admin 不得直接使用平台 SDK 全局(wx/dd)", () => {
  const dirs = [path.join(webRoot, "apps/admin/src")];
  for (const dir of dirs) {
    for (const f of walk(dir)) {
      if (!/\.(ts|vue)$/.test(f)) {
        continue;
      }
      const text = stripComments(readFileSync(f, "utf8"));
      // 只看**用到了平台 SDK 全局**的代码(声明与注释不算)
      const hit = text.match(/\b(window\.(wx|dd)|wx\.invoke|dd\.runtime|dd\.biz)\b/);
      if (hit) {
        problems.push(
          `R7:${path.relative(webRoot, f)} 直接使用平台 SDK「${hit[0]}」—— ` +
            "管理后台是纯 Web 页面,不应依赖任一平台注入的全局对象",
        );
      }
    }
  }
});

console.log("");
if (problems.length > 0) {
  console.error("前端纪律检查未通过:");
  for (const p of problems) {
    console.error("  ✗ " + p);
  }
  process.exit(1);
}
console.log(`全部通过:${checks.length} 条前端纪律。`);
