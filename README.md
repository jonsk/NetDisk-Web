# web · 网盘前端（管理后台）

> 独立仓库（从原 monorepo `netdisk` 的 `web/` 拆分而来，保留历史）。
> Vue 3 + TypeScript + pnpm workspace，单一构建目标：

- `apps/admin` — 管理后台（仅管理员：用户/部门/空间/配额）— Naive UI
- `packages/api` — 契约生成的基础库（DTO/类型）

## 常用命令

```bash
pnpm install --frozen-lockfile
pnpm build            # 产物到 apps/admin/dist（AD1-4：供 Go embed 拷贝）
pnpm -r typecheck     # 类型检查
pnpm check:api        # 契约生成物一致性门禁（openapi 双向 diff）
pnpm check:rules      # 前端纪律静态检查
```

## 契约

接口契约唯一真相在项目文档 `api/openapi.yaml`（`D:\WorkSpace\GO\Doc\api\openapi.yaml`）；
多端模型由它生成，变更需过 `check:api` 双向 diff 门禁。

## 说明

前端产物须先 `pnpm build` 再编译 Go（`/admin` 由服务端 `embed` 提供）。
本仓库不含架构设计正文（见 `Server-Ent` / `Server-com` 的 README 指向的设计文档）。
