# Architecture Design

> Records this repository's (web frontend) architecture decisions and design conventions.
> Contract, layout, build target, and backend are tightly coupled.

## 1. Repository Shape

- **Single-build-target pnpm workspace**: `apps/*` + `packages/*`.
- Community Edition keeps only the admin console; no H5 workspace, no IdP integration, no
  audit logs.
- Contract is **vendored** into this repo at `DOC/api/openapi.yaml` (authoritative source in
  the server repo; three locations to keep in sync: server / web / desktop).

## 2. Technology Choices (key decisions)

| Concern | Choice | Reason |
|---|---|---|
| Framework | Vue 3 (`<script setup>`) | Composition, mature ecosystem |
| Build | Vite 5 | Fast, hashable artifacts |
| State | Pinia | Recommended for Vue 3 |
| UI | Naive UI | TS-friendly, on-demand |
| Router | Vue Router 4 (History) | Works with Go SPA fallback |
| Types | TS strict + vue-tsc | Discipline locked in by gates |
| Package manager | pnpm | Workspace + strict deps |
| Contract | openapi-typescript | Single source generating multi-end models |
| Toolchain | node ≥ 20, pnpm ≥ 9.15.9 | CI matches local |

## 3. Deployment Shape (embeddable frontend)

The frontend has **no standalone static server**: build output is copied via `pnpm build`
into the server `internal/webui/dist/` and served by Go `embed`, same-origin single port.

This yields three **deployment-bound** settings (changing them blanks the app):

1. **Vite `base: "/admin/"`**: the frontend hangs at the sub-path `/admin`; asset URLs must
   start with it, otherwise 404 (blank screen + a pile of 404s in the console).
2. **`createWebHistory("/admin/")`** matches `base`; Go already implements SPA fallback.
3. **`outDir: "dist"`**: the directory name must not change, or `go:embed` cannot find it;
   the gen script copies `web/apps/admin/dist` to `server/internal/webui/dist/admin`.

**Build-order discipline**: run `pnpm build` before compiling Go — otherwise the server
embeds a stale artifact (silent wrong version).

## 4. Contract Single-Source Mechanism

```
DOC/api/openapi.yaml
        │  pnpm gen:api (openapi-typescript)
        ▼
packages/api/src/schema.gen.ts   ← generated output, do NOT hand-edit
        │  pnpm check:api (lint-contract --check-generated, bidirectional diff)
        ▼
        all contract models / all interface types
```

- Type entry points `Schema` / `Operations` / `Paths` all come from the generated output.
- `lint:contract`'s three hard constraints (hand-written fetch, hand-written same-named
  DTO, stale generated output) force requests to converge into the client, keeping
  "contract single-source" from being bypassed (implementation details in 06-Test Document
  "Contract Gate").
- `gen-csharp` generates desktop C# models from the same contract, keeping multi-end
  understanding consistent.

## 5. Module Responsibilities & Layering

```
views/ (pages: login/overview/users & departments/space governance)
   │  via auth.client()
   ▼
stores/auth.ts (auth state: login/refresh/logout/token) — holds token & refresh logic
   │
   ▼
packages/api (Client/APIError/types) — the only place fetch may appear
   │
   ▼
server REST API (defined by the contract)
```

Principles:

- Pages never build requests by hand — they always go through `auth.client()`;
- token holding and refresh live in the store; the client only sends and replays;
- errors are uniform `APIError`, branched by `code`.

## 6. Page Boundaries (product decisions)

- **Web console = global governance**: creating spaces/inviting members/leaving live in the
  desktop client; the console does not provide them (avoids an unclear extra entry point in
  the permission model).
- **No online preview** (images/PDF/Office); file operations are in the desktop client.
- Usage is read-only; the warning threshold is a reminder line, not a cap;
  **revoke ≠ delete** (files are not deleted; only freeze + clear members).

## 7. Frontend Discipline (check:rules)

The admin console enforces 7 discipline rules (R1~R7) through
`scripts/check-frontend-rules.mjs`: per-client audience, token storage, guards preserving
the original URL, 401 silent refresh & replay, entry restore ordering, protected APIs going
through the client, and no platform SDK globals. Each rule has a "break it → red" reverse
check. Full rules and consequences are in **06-Test Document "Frontend Discipline"**.

## 8. CI

`.github/workflows/ci.yml` runs the gate chain on push/PR (master/main) and verifies the
admin artifact can be embedded; `gen-csharp` (desktop models) belongs to the desktop repo
after the split. Full gate order is in **06-Test Document "Automated Gates Overview"**.
