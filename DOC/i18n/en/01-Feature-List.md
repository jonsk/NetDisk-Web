# Feature List

> This repository is NetDisk NetDisk's **Web frontend (admin console)**, Vue 3 + TypeScript + pnpm workspace.

## Repository Purpose

| Item | Content |
|---|---|
| Name | **web** (NetDisk frontend · Community Edition) |
| Nature | Vue 3 + TypeScript + pnpm workspace; single build target `admin` |
| Stack | Vue 3 / Vite / Pinia / Naive UI / openapi-typescript |
| Consumer | Built output is copied via `pnpm build` into the server `internal/webui/dist/` and served by Go `embed` |
| Contract | This repo vendors a copy of `DOC/api/openapi.yaml` (authoritative source: `Doc/api/openapi.yaml`) |

**Subdirectories**: `apps/admin`, `packages/api`, `scripts`, `DOC`.

---

## A. Admin Console (`apps/admin`) — IT administrators only

| Page / Module | File | Function |
|---|---|---|
| Login | `views/LoginView.vue` + `stores/auth.ts` | Admin login, token storage / silent refresh |
| Overview | `views/OverviewView.vue` | Current session info (user/role/audience/request_id) |
| Users & Departments | `views/UsersView.vue` | User/department CRUD, disable/enable, role change, confirmation dialogs |
| Space Governance | `views/SpacesView.vue` | Space list, quota/warning threshold, freeze, revoke |
| Framework | `layouts/AdminLayout.vue` + `router/index.ts` | Layout, route guards (login/auth/original URL) |

> **Capability boundary (finalized)**: no online preview (images / PDF / Office); file
> browsing and transfer live in the desktop client. The web console only does
> **global governance**; collaborative management entries such as creating spaces/inviting
> members live in the desktop client.

### Per-page details

- **Login**: explicitly passes `audience: "web"` (per-client audience), token stored in
  `sessionStorage`, unified login-failure message (does not distinguish "user not found /
  wrong password"), 429 shown separately.
- **Overview**: shows only the current user; deliberately no fake-data charts.
- **Users & Departments**: server-side search/pagination (not frontend filtering), disable
  confirmation (has external impact), unique-conflict errors mapped to specific input
  fields, department tree add/delete.
- **Space Governance**: usage is read-only (only changed by upload/delete transactions);
  the warning threshold is a "reminder line", not a cap (the 95% cap is a server-side hard
  policy); **revoke ≠ delete** (freeze + clear members, files are NOT deleted).

---

## B. Shared Libraries (`packages/`)

- **`packages/api`**:
  - `src/schema.gen.ts` — OpenAPI-generated types (contract single-source, **do NOT edit
    by hand**);
  - `src/index.ts` — typed REST client wrapper (fetch/DTO/token injection/silent refresh),
    the only place where `fetch(` may appear.

---

## C. Engineering Gates (`scripts/`)

- **`lint-contract.mjs`** (`check:api` / `lint:contract`): contract gate — constrains
  hand-written fetch, hand-written same-named DTOs, and stale generated output (details in
  06-Test Document "Contract Gate").
- **`check-frontend-rules.mjs`** (`check:rules`): 7 frontend discipline rules (R1~R7),
  each with a reverse check (details in 06-Test Document "Frontend Discipline").
- **`gen-csharp.mjs`**: desktop C# model generation hook (when `desktop/` does not exist,
  only validates the chain and exits 0).

---

## D. Build & Scripts (`package.json`)

`build` / `build:admin` / `dev:admin` / `typecheck` / `lint` / `gen:api` /
`gen:csharp` / `check:api` / `lint:contract` / `check:rules`
