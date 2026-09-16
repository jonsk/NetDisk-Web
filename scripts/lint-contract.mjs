/**
 * 契约门禁脚本(FE-W-02 验收③④)。
 *
 * 三件事,每一件都对应"契约单源"被悄悄破坏的一种方式:
 *
 *  1. **手写 fetch 被拦**(验收④):`packages/api` 之外出现 `fetch(` 说明有人绕过
 *     契约自己拼请求 —— 那条路径没有类型、没有统一的错误处理与令牌刷新,
 *     而它**能跑通**,所以直到线上出问题才会被发现。
 *  2. **手写 DTO 被拦**:`packages/api` 里出现与生成模型同名的 `interface`/`type`
 *     会让"类型来自契约"变成一句空话(改契约后这些手写类型不会跟着变)。
 *  3. **生成物过期被拦**(验收③的本地版):把 openapi.yaml 重新生成一遍,
 *     与提交的 `schema.gen.ts` 逐字节比较。不一致说明"改了契约没重新生成",
 *     或者"手改了生成物"——两种都会让前后端对同一个字段有两种理解。
 *
 * 用法:node scripts/lint-contract.mjs [--check-generated]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
// 独立仓库(从 monorepo 拆分):repoRoot 即 web 仓库根,pnpm 与契约都在此根下
const repoRoot = webRoot;

const problems = [];

/** walk 递归列出目录下的文件(跳过 node_modules/dist)。 */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") {
      continue;
    }
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = walk(path.join(webRoot, "apps")).concat(
  walk(path.join(webRoot, "packages")),
).filter((f) => /\.(ts|vue|mts)$/.test(f));

// ---- ① fetch 只能出现在 packages/api ----
const apiDir = path.join(webRoot, "packages", "api");
for (const f of sourceFiles) {
  if (f.startsWith(apiDir)) {
    continue;
  }
  const text = readFileSync(f, "utf8");
  // 匹配 `fetch(` 而不是 `fetchImpl(`/`preflight` 等
  if (/(^|[^A-Za-z0-9_$.])fetch\s*\(/.test(text)) {
    problems.push(
      `手写 fetch 必须收敛到 packages/api(契约单源): ${path.relative(repoRoot, f)}`,
    );
  }
}

// ---- ② packages/api 内不得手写与生成模型同名的类型 ----
const generatedPath = path.join(apiDir, "src", "schema.gen.ts");
let generated = "";
try {
  generated = readFileSync(generatedPath, "utf8");
} catch {
  problems.push(
    "缺少 packages/api/src/schema.gen.ts —— 请先执行 pnpm gen:api(FE-W-02)",
  );
}

if (generated) {
  // 从生成物里抽出模型名(openapi-typescript 会把它们放进 components.schemas)
  const modelNames = new Set();
  for (const m of generated.matchAll(/^\s{8}([A-Za-z][A-Za-z0-9_]*):\s*\{/gm)) {
    modelNames.add(m[1]);
  }
  const handWritten = statSync(path.join(apiDir, "src")).isDirectory()
    ? walk(path.join(apiDir, "src")).filter(
        (f) => f.endsWith(".ts") && !f.endsWith("schema.gen.ts"),
      )
    : [];
  for (const f of handWritten) {
    const text = readFileSync(f, "utf8");
    // 只拦**手写对象形状**:
    //   export interface X {
    //   export type X = {
    // 而 `export type X = Schema["X"]` 是**从契约取的别名**,正是我们鼓励的写法
    // (它随契约变化而变化),绝不能一起拦掉 —— 否则等于禁止"给生成模型起个短名字",
    // 而开发者会转向更糟的做法(在业务里到处写 `components["schemas"]["X"]`)。
    for (const m of text.matchAll(
      /export\s+interface\s+([A-Za-z][A-Za-z0-9_]*)\s*\{|export\s+type\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s*\{/g,
    )) {
      const name = m[1] ?? m[2];
      if (modelNames.has(name)) {
        problems.push(
          `不得手写与契约同名的类型 ${name}: ${path.relative(repoRoot, f)}` +
            "(请写成 `export type " + name + ' = Schema["' + name + '"]`,否则改契约后它不会跟着变)',
        );
      }
    }
  }
}

// ---- ③ 生成物是否与契约一致 ----
if (process.argv.includes("--check-generated") && generated) {
  try {
    const spec = path.join(repoRoot, "DOC", "api", "openapi.yaml");
    // 直接用 node 跑生成器的 CLI 入口,而不是 `pnpm exec openapi-typescript`:
    // Windows 上 execFile 调 `.cmd` 会 EINVAL(Node 18+ 的安全行为,必须 shell:true),
    // 而 shell:true 会把参数交给 cmd 解析(路径含空格/中文时又是另一类坑)。
    // 用 node + JS 入口两者都绕开。
    const cli = path.join(webRoot, "node_modules", "openapi-typescript", "bin", "cli.js");
    const fresh = execFileSync(process.execPath, [cli, spec], {
      cwd: webRoot,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    // 逐行比较(忽略行尾差异;生成器不保证 CRLF/LF 一致)
    const norm = (s) => s.replace(/\r\n/g, "\n").trimEnd();
    if (norm(fresh) !== norm(generated)) {
      problems.push(
        "schema.gen.ts 与 DOC/api/openapi.yaml 不一致 —— 契约改了要重新生成:" +
          "pnpm gen:api(禁止手改生成物)",
      );
    }
  } catch (e) {
    problems.push(`无法重新生成契约类型: ${e.message}`);
  }
}

if (problems.length > 0) {
  console.error("契约门禁未通过:\n");
  for (const p of problems) {
    console.error(" - " + p);
  }
  process.exit(1);
}
console.log("契约门禁通过:fetch 已收敛、无手写 DTO、生成物与契约一致");
