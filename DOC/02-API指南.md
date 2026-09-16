# API 指南

> 前端调用服务端的**唯一方式**是通过 `packages/api` 提供的类型化客户端。
> 手写 fetch 被静态门禁禁止（见下文「契约纪律」）。

## 目录

1. [契约单源](#1-契约单源)
2. [客户端使用](#2-客户端使用)
3. [错误模型](#3-错误模型)
4. [认证与令牌](#4-认证与令牌)
5. [接口一览](#5-接口一览)
6. [契约纪律](#6-契约纪律)

---

## 1. 契约单源

接口契约唯一真相在服务端仓 `Doc/api/openapi.yaml`；本仓在
`DOC/api/openapi.yaml` 存放 vendor 副本。契约一旦修改：

```bash
pnpm gen:api        # 重新生成 TS 类型到 packages/api/src/schema.gen.ts
pnpm check:api      # 双向 diff 门禁：生成物必须与契约一致
```

`packages/api/src/schema.gen.ts` 为**生成物，禁止手改**。类型入口：

```ts
import type { components, operations, paths, Schema } from "@netdisk/api";
// Schema = components["schemas"] —— 契约全部模型
```

## 2. 客户端使用

`Client` 是唯一的 REST 调用入口，只暴露 `request` 一个方法（外加原始 `send`）。

```ts
import { Client } from "@netdisk/api";

const c = new Client({
  getToken: () => this.token,          // 注入当前 access token
  onUnauthorized: () => this.refresh(), // 401 时静默刷新回调
});

// JSON 请求
const me = await c.request<Record<string, unknown>>("/api/v1/me");

// 带查询参数
const res = await c.request<{ users: User[]; total: number }>(
  `/api/v1/admin/users?${new URLSearchParams({ limit: "20" }).toString()}`,
);

// 写请求
await c.request("/api/v1/admin/departments", {
  method: "POST",
  body: { parent_id: "", name: "研发" },
});
```

关键行为：

- **令牌注入**：自动加 `Authorization: Bearer <token>`。
- **401 静默刷新**：有 `onUnauthorized` 时先刷新再**重放一次**原请求。
- **二进制体**：`Blob`/`FormData`/`ArrayBuffer` 原样发送，不擅自设
  `Content-Type`（避免分片上传被序列化成空对象）。
- **结构化错误**：非 2xx 一律抛 `APIError`（见下）。
- **同源**：默认 baseURL 为空，与后端同源（`credentials: "same-origin"`）。

调用方持有令牌与刷新逻辑（在 `stores/auth.ts`），客户端只负责发送与重放。

## 3. 错误模型

所有错误统一抛 `APIError`，调用方按 `code` 分流，**不解析 message 文案**：

```ts
import { APIError } from "@netdisk/api";

try {
  await c.request(...);
} catch (e) {
  if (e instanceof APIError) {
    // e.status    —— HTTP 状态码
    // e.code      —— 业务错误码（如 account_conflict）
    // e.details   —— 结构化附加信息（如冲突字段 details.field）
    // e.requestId —— 排障用的请求 ID
    // 便捷谓词：
    //   e.isAuthError     —— status === 401
    //   e.isSpaceRevoked  —— code ∈ {space_revoked, space_gone}
  }
}
```

## 4. 认证与令牌

管理后台登录流程位于 `apps/admin/src/stores/auth.ts`：

- 登录传 `audience: "web"`（分端受众，写错表现为"登录成功但接口全 403"）。
- access token 与 refresh token 只存 **sessionStorage**（共用电脑安全）。
- 过期时 `refresh()` 用 refresh token 换新 access token，成功后回填并重放请求；
  刷新失败才 `logout()` 送回登录页。
- 路由守卫在 `auth.ready` 之前不跳转，避免刷新页面闪烁；未登录跳登录页并
  用 `redirect` 查询参数**保留原地址**。

## 5. 接口一览

契约覆盖的一期接口（完整定义见 `DOC/api/openapi.yaml`）：

| 分类 | 端点 | 说明 |
|---|---|---|
| auth | `GET /api/v1/version`、`GET /api/v1/me` | 版本、当前登录者 |
| auth | `POST /api/v1/auth/{login,refresh,logout}` | 登录/刷新/登出 |
| files | `GET /api/v1/files`、`files/dirs`、`files/{id}` | 文件/目录列表与详情 |
| files | `files/{id}/content`、`move`、`copy`、`subtree-stats`、`share-to-space`、`lock` | 内容/移动/复制/统计/共享/锁 |
| upload | `POST /api/v1/upload/create`、`{id}`、`{id}/finish` | 分片上传 |
| sync | `GET /api/v1/changes`、`changes/head`、`sync/cursors` | 变更流/游标 |
| shares | `shares`、`shares/{id}`、`shares/{token}/meta`、`.../download` | 分享 |
| admin | `departments`、`departments/{id}` | 部门（admin） |
| admin | `spaces`、`spaces/{id}` 等 | 空间列表/详情管理 |
| admin | `admin/users`、`admin/departments`、`admin/spaces/{id}/freeze` 等 | 用户/部门/空间治理 |

> 管理后台当前主要消费：`auth/*`、`me`、`admin/users`、`admin/departments`、
> `admin/spaces`（含 quota/freeze/revoke）。

## 6. 契约纪律

`pnpm lint:contract`（`check:api` 的内核）强制三条，保证"契约单源"不被旁路：
**手写 fetch 被拦**、**手写同名 DTO 被拦**、**生成物过期被拦**。完整规则与
通过/失败输出见 **06-测试文档「契约门禁」**。
