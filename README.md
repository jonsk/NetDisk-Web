# NetDisk Web（网盘前端）

> 企业网盘「NetDisk」的管理后台前端。Vue 3 + TypeScript + pnpm workspace，
> 通过 OpenAPI 契约与服务端、桌面端共享同一套接口模型。

NetDisk 是一套企业级网盘系统：本仓库是它的 **Web 前端（管理后台）**，面向
IT 管理员提供用户/部门、空间与配额等治理能力。文件浏览与传输在桌面客户端完成，
本仓库**刻意不实现在线预览与文件传输**，这是产品边界而非未完成项。

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

---

## 🌐 多语言 / Translations

[中文](README.md) | [English](DOC/i18n/en/README.md) | [Deutsch](DOC/i18n/de/README.md) | [Français](DOC/i18n/fr/README.md) | [Suomi](DOC/i18n/fi/README.md) | [Русский](DOC/i18n/ru/README.md)

---

## ✨ 特性

- **管理后台（`apps/admin`）**：仅管理功能，登录 / 概览 / 用户与部门 / 空间治理，
  基于 [Naive UI](https://www.naiveui.com) 构建。
- **契约单源**：所有前后端共享的接口模型由 `DOC/api/openapi.yaml` 生成，
  双向 diff 门禁保证生成物永不与契约脱节。
- **统一 API 客户端（`packages/api`）**：类型化 REST 客户端，内建结构化错误、
  令牌注入与 401 静默刷新；**手写 fetch 被静态门禁禁止**，全部请求收敛于此。
- **工程门禁（`scripts/`）**：契约一致性、前端纪律（分端受众/令牌存储/守卫/
  静默刷新等 7 条）均为零依赖静态检查，可直接在 CI 运行。
- **可嵌入部署**：产物经 `pnpm build` 拷入服务端由 Go `embed` 提供，同源单端口。

## 🧰 技术栈

| 领域 | 选型 |
|---|---|
| 框架 | Vue 3（Composition API / `<script setup>`） |
| 构建 | Vite 5 |
| 状态 | Pinia |
| UI | Naive UI |
| 路由 | Vue Router 4（History 模式，挂在 `/admin/` 子路径） |
| 类型 | TypeScript（strict）、vue-tsc |
| 包管理 | pnpm（workspace, ≥9.15.9） |
| 契约 | openapi-typescript（OpenAPI 3.1） |

## 📦 快速开始

环境要求：Node ≥ 20、pnpm ≥ 9.15.9。

```bash
# 安装依赖（使用 lockfile 的精确版本）
pnpm install --frozen-lockfile

# 开发（Vite dev server，/api 代理到 http://127.0.0.1:8080）
pnpm dev:admin

# 生产构建（产物输出到 apps/admin/dist，供服务端 embed 拷贝）
pnpm build

# 类型检查 / 契约门禁 / 前端纪律
pnpm -r typecheck
pnpm check:api
pnpm check:rules
```

## 🔁 常用命令

```bash
pnpm dev:admin     # 启动管理后台开发服务器（端口 5174）
pnpm build         # 构建管理后台
pnpm typecheck     # 全仓类型检查
pnpm lint          # 全仓 lint
pnpm gen:api       # 从 openapi.yaml 重新生成 TS 类型
pnpm gen:csharp    # （可选）从契约生成桌面端 C# 模型
pnpm check:api     # 契约生成物一致性门禁（双向 diff）
pnpm lint:contract # 契约 lint：禁止手写 fetch / 手写同名 DTO
pnpm check:rules   # 前端纪律静态检查（7 条）
```

## 📁 仓库结构

```
.
├─ apps/admin/          # 管理后台（登录/概览/用户部门/空间治理）
│  └─ src/
│     ├─ layouts/       #   AdminLayout：侧边栏 + 顶栏
│     ├─ router/        #   路由与守卫
│     ├─ stores/        #   Pinia 状态（认证 store）
│     └─ views/         #   页面视图
├─ packages/api/        # 契约生成的基础库（类型 + REST 客户端 + 错误模型）
├─ scripts/             # 工程门禁脚本
├─ DOC/                 # 项目文档 + OpenAPI 契约（DOC/api/openapi.yaml）
```

## 📚 文档

| 编号 | 文档 | 说明 |
|---|---|---|
| 01 | [DOC/01-功能清单.md](DOC/01-功能清单.md) | 各模块功能清单 |
| 02 | [DOC/02-API指南.md](DOC/02-API指南.md) | 契约与 API 客户端使用指南 |
| 03 | [DOC/03-代码阅读指南.md](DOC/03-代码阅读指南.md) | 目录导览与代码组织说明 |
| 04 | [DOC/04-架构设计文档.md](DOC/04-架构设计文档.md) | 架构决策与设计说明 |
| 05 | [DOC/05-编译与部署.md](DOC/05-编译与部署.md) | 构建、产物嵌入与部署 |
| 06 | [DOC/06-测试文档.md](DOC/06-测试文档.md) | 测试策略与门禁说明 |

> 🌐 以上文档的多语言翻译见顶部「多语言 / Translations」表。

## 🔐 契约与协作

接口契约唯一真相在服务端仓 `Doc/api/openapi.yaml`；本仓在
`DOC/api/openapi.yaml` 存放 vendor 副本（三处需同步：服务端/web/桌面端）。
任何接口改动必须：
1. 修改权威契约；
2. 执行 `pnpm gen:api` 重新生成类型；
3. 通过 `pnpm check:api` 双向 diff 门禁。

严禁手改生成物 `packages/api/src/schema.gen.ts`。

## 🚀 CI

`.github/workflows/ci.yml` 在 push/PR 到 `master`/`main` 时执行：
`pnpm install --frozen-lockfile → check:api → typecheck → check:rules → build →`
校验 `apps/admin/dist/index.html` 存在（保证产物可被 embed）。

## 📄 许可证

[Apache License 2.0](LICENSE) · Copyright © 2026 NetDisk Contributors
