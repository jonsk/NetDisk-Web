/**
 * 桌面端(NetDisk.ClientCore)C# 模型生成钩子(FE-W-02 验收②)。
 *
 * 为什么需要它:`DOC/api/openapi.yaml` 是唯一契约,web 端已经用
 * `pnpm gen:api` 生成 TS 类型;桌面端如果靠手写 C# 模型,就会出现
 * **同一份契约、两套手写理解** —— 而且 C# 那套没有任何门禁能发现它过期了
 * (编译器不会因为 openapi.yaml 改了而报错),典型症状是字段名/可空性
 * 与服务端不一致,反序列化后静默变成 null。
 *
 * 第 3 卷只做"链路打通":桌面端代码在第 4 卷(DE-D-*)才落地,现在 `desktop/`
 * 还不存在。所以本脚本的设计是:
 *
 *   - **永远解析契约并做完整映射**(即使不写文件)—— 这样"契约 → C# 模型"
 *     这段逻辑今天就被真实契约跑过一遍,而不是等第 4 卷才发现它早就坏了;
 *   - `desktop/` 不存在时**只打印跳过原因并退出 0**(不是失败):构建流水线
 *     在第 4 卷之前不该因为桌面端缺席而红;
 *   - 存在时写入 `desktop/src/NetDisk.ClientCore/Generated/Models.g.cs`,
 *     并在写入前做**逐字节比对**,不一致才落盘 —— 于是 `gen:csharp` 天然
 *     可用于 CI 的"契约改了要重新生成"门禁(与 `check:api` 同构)。
 *
 * 用法:node scripts/gen-csharp.mjs [--check]
 *   --check:只校验生成物是否最新,不写文件(CI 用;不一致则退出 1)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import yaml from "js-yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
// 独立仓库(从 monorepo 拆分):分析与写入都以本仓为根;桌面端不在本仓,
// 该分支始终走"仅校验链路、退出 0"
const repoRoot = webRoot;
const specPath = path.join(repoRoot, "DOC", "api", "openapi.yaml");

const checkOnly = process.argv.includes("--check");

// ---- 1. 解析契约(与 gen:api 读的是同一个文件) ----
const spec = yaml.load(readFileSync(specPath, "utf8"));
const schemas = spec?.components?.schemas ?? {};

if (Object.keys(schemas).length === 0) {
  console.error(`契约里没有 components.schemas: ${specPath}`);
  process.exit(1);
}

// ---- 2. JSON Schema 子集 → C# 类型 ----
// 只覆盖本契约实际用到的构造:标量、array、$ref、字符串枚举、
// object+additionalProperties(details 字典)、可空性。
// 遇到没覆盖的构造**直接抛错**而不是降级成 object:string —— 降级会让
// 生成的 C# 能编译但拿不到字段,是"静默错误"里最难查的一类。
const problems = [];

function csType(node, ctx) {
  if (!node || typeof node !== "object") {
    throw new Error(`${ctx}: schema 节点不是对象`);
  }
  if (node.$ref) {
    const name = node.$ref.split("/").pop();
    if (!schemas[name]) {
      problems.push(`${ctx}: $ref 指向不存在的模型 ${name}`);
    }
    return name;
  }
  if (Array.isArray(node.enum) && node.enum.every((v) => typeof v === "string")) {
    // 字符串枚举 → 生成独立 enum(名字由调用方给),这里返回占位
    return { enum: node.enum };
  }
  switch (node.type) {
    case "string":
      return "string";
    case "integer":
      return node.format === "int32" ? "int" : "long";
    case "number":
      return node.format === "float" ? "float" : "double";
    case "boolean":
      return "bool";
    case "array":
      return `List<${scalar(csType(node.items, ctx + "[]"))}>`;
    case "object": {
      if (node.properties) {
        // 内联对象(本契约里只有少量响应包装);用嵌套 record 表达会引入
        // 命名歧义,这里直接报错逼契约作者给它起个 $ref 名字。
        throw new Error(
          `${ctx}: 内联 object 未命名 —— 请在 openapi.yaml 里给它一个 components.schemas 名字`,
        );
      }
      if (node.additionalProperties) {
        const v = node.additionalProperties === true
          ? "object"
          : scalar(csType(node.additionalProperties, ctx + ".<value>"));
        return `Dictionary<string, ${v}>`;
      }
      return "Dictionary<string, object>";
    }
    default:
      throw new Error(`${ctx}: 不支持的 schema 构造 ${JSON.stringify(node.type)}`);
  }
}

/** 把 csType 的返回值(可能是 enum 占位)转成可用的 C# 类型名。 */
function scalar(t) {
  if (t && typeof t === "object" && t.enum) {
    // 内联枚举(出现在 properties/array 里)也必须先在上层被提升为具名 enum;
    // 走到这里说明契约里有个匿名枚举,报错要求具名。
    throw new Error(`匿名字符串枚举未命名:[${t.enum.join(", ")}]`);
  }
  return t;
}

const files = []; // { name, body }

for (const [name, schema] of Object.entries(schemas)) {
  const required = new Set(schema.required ?? []);
  const lines = [];
  const extraTypes = [];

  lines.push(`/// <summary>${name}</summary>`);
  lines.push(`public sealed record ${name}`);
  lines.push("{");

  for (const [prop, decl] of Object.entries(schema.properties ?? {})) {
    const jsonName = prop;
    const csName = prop;
    const isRequired = required.has(jsonName);
    let type = csType(decl, `${name}.${prop}`);

    // 具名字符串枚举:提升为独立 enum,字段类型换成它
    if (type && typeof type === "object" && type.enum) {
      const enumName = name + toPascal(prop) + "Kind";
      extraTypes.push(renderEnum(enumName, type.enum));
      type = enumName;
    }
    type = scalar(type);
    if (!isRequired) {
      type += "?";
    }

    const attrs = [];
    if (csName !== jsonName) {
      attrs.push(`[JsonPropertyName("${jsonName}")]`);
    }
    if (!isRequired) {
      attrs.push("[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]");
    }
    if (attrs.length) lines.push("    " + attrs.join("\n    "));
    // required 属性带 `required` 修饰符:C# 11+ 的 required + System.Text.Json
    // 会在**缺少该字段时直接抛错**,而不是静默留 null/0 —— 契约里标了
    // required 的字段丢了,就是要炸出来,这是"两侧理解一致"唯一的硬保证。
    // 剩下的引用类型属性一律加 `?`,避免 CS8618(编译器会把"可空"当成事实)。
    lines.push(
      `    public ${isRequired ? "required " : ""}${type} ${csName} { get; init; }`,
    );
  }

  lines.push("}");
  files.push({ name, body: extraTypes.concat(lines).join("\n") });
}

function renderEnum(enumName, values) {
  const members = values
    .map((v) => `    [EnumMember(Value = "${v}")]\n    ${toPascal(v)},`)
    .join("\n");
  return [
    `[JsonConverter(typeof(JsonStringEnumConverter))]`,
    `public enum ${enumName}`,
    "{",
    members,
    "}",
  ].join("\n");
}

function toPascal(s) {
  return s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("");
}

if (problems.length > 0) {
  console.error("C# 模型生成失败(契约有悬空引用):");
  for (const p of problems) console.error(" - " + p);
  process.exit(1);
}

const header = [
  "// <auto-generated />",
  "// 由 web/scripts/gen-csharp.mjs 从 DOC/api/openapi.yaml 生成,请勿手改。",
  "// 重新生成:pnpm gen:csharp(在 web/ 目录下)",
  "// 需要 C# 11+ / .NET 7+(用到 required 成员);桌面端目标框架为 net10.0-windows。",
  "#nullable enable",
  "using System.Collections.Generic;",
  "using System.Text.Json.Serialization;",
  "using System.Runtime.Serialization;",
  "",
].join("\n");

const output = header + files.map((f) => f.body).join("\n\n") + "\n";
const target = path.join(
  repoRoot,
  "desktop",
  "src",
  "NetDisk.ClientCore",
  "Generated",
  "Models.g.cs",
);

// ---- 3. 桌面端还不存在 → 只验证链路,跳过写入 ----
if (!existsSync(path.join(repoRoot, "desktop"))) {
  console.log(
    `跳过 C# 模型写入:desktop/ 尚未创建(第 4 卷 DE-D-* 落地)。` +
      `契约映射已校验:${files.length} 个模型、${output.split("\n").length} 行,` +
      `目标路径 ${path.relative(repoRoot, target)}`,
  );
  process.exit(0);
}

const current = existsSync(target) ? readFileSync(target, "utf8") : "";
const norm = (s) => s.replace(/\r\n/g, "\n");
if (norm(current) === norm(output)) {
  console.log(`C# 模型已是最新:${path.relative(repoRoot, target)}(${files.length} 个模型)`);
  process.exit(0);
}

if (checkOnly) {
  console.error(
    `C# 模型与契约不一致:${path.relative(repoRoot, target)}` +
      " —— 请执行 pnpm gen:csharp 重新生成(禁止手改生成物)",
  );
  process.exit(1);
}

mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, output, { encoding: "utf8", newline: "\n" });
console.log(
  `已生成 C# 模型:${path.relative(repoRoot, target)}(${files.length} 个模型)`,
);
