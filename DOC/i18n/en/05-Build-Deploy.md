# Build & Deployment

> The full flow from scratch to a complete build and embedding the artifact into the
> server. Leading discipline: **run `pnpm build` before compiling Go** — otherwise the
> server embeds a stale artifact (silent wrong version).

## 1. Environment Requirements

| Tool | Version |
|---|---|
| Node.js | ≥ 20 (CI uses 22) |
| pnpm | ≥ 9.15.9 (recommend the exact version from the lockfile) |
| Go | server (≥ 1.x) — for embedding the artifact |

## 2. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

`--frozen-lockfile` guarantees the installed versions exactly match `pnpm-lock.yaml`
(CI does the same).

## 3. Development

```bash
pnpm dev:admin
```

Starts the Vite dev server (port **5174**), proxying `/api` to `http://127.0.0.1:8080`
(decided by `server.proxy` in `vite.config.ts`; connects directly to the local server,
same-origin shape as production).

## 4. Production Build

```bash
pnpm build
```

Equivalent to `pnpm --filter @netdisk/admin build` (`vite build`); output goes to
**`apps/admin/dist`**.

Key build behaviors (`apps/admin/vite.config.ts`):

- `base: "/admin/"` — asset URLs start with the sub-path;
- `outDir: "dist"`, `emptyOutDir: true`;
- `target: "es2021"` — browser floor (compat with older WeCom/DingTalk embedded WebViews);
- sourcemaps off in production (avoid shipping source/endpoint paths);
- asset filenames carry content hashes (`assets/[name]-[hash].js`) → the basis for long caching.

## 5. Contract & Gates (recommended before building)

```bash
pnpm gen:api       # regenerate types after a contract change
pnpm check:api     # generated-vs-contract consistency gate (bidirectional diff)
pnpm -r typecheck  # full-repo type check
pnpm check:rules   # frontend discipline (7 rules)
```

CI runs `check:api → typecheck → check:rules` before building; any failure turns red.

## 6. Embedding the Artifact into the Server (key steps)

1. In `web-com`, run `pnpm build` to get `apps/admin/dist`;
2. Copy `apps/admin/dist` into the server `internal/webui/dist/admin/` (the directory name
   must not change — `go:embed` depends on it);
3. Then compile the Go binary — after that `/admin` is served by the server `embed`,
   same-origin with the API.

> ⚠️ Wrong order (go build before pnpm build) leaves the server embedding the old admin
> artifact; verify `/admin/index.html` is the new version before publishing to production.

## 7. Deployment Shape Quick Reference

- Single port: frontend and API are both served same-origin from the Go binary (Nginx only
  does TLS and routing; it does not host static assets).
- Sub-path: admin hangs at `/admin/`; SPA fallback is implemented by Go's `webui.Handler`,
  no extra rewrite needed.

> The three "deployment-bound" settings (Vite `base` / history / `outDir`) and their
> blank-screen consequences are detailed in 04-Architecture "Deployment Shape".

## 8. Verifying the Artifact

```bash
# Minimum check that the artifact can be embedded (same as CI)
test -f apps/admin/dist/index.html || (echo "admin artifact missing" && exit 1)
```
