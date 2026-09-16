# API Guide

> The **only** way for the frontend to call the server is through the typed client
> provided by `packages/api`. Hand-written `fetch` is forbidden by a static gate
> (see "Contract Discipline" below).

## Table of Contents

1. [Contract Single-Source](#1-contract-single-source)
2. [Using the Client](#2-using-the-client)
3. [Error Model](#3-error-model)
4. [Authentication & Tokens](#4-authentication--tokens)
5. [API Overview](#5-api-overview)
6. [Contract Discipline](#6-contract-discipline)

---

## 1. Contract Single-Source

The authoritative interface contract lives in the server repo at `Doc/api/openapi.yaml`;
this repo keeps a vendored copy at `DOC/api/openapi.yaml`. Whenever the contract changes:

```bash
pnpm gen:api        # regenerate TS types into packages/api/src/schema.gen.ts
pnpm check:api      # bidirectional-diff gate: generated output must match the contract
```

`packages/api/src/schema.gen.ts` is **generated output — editing it by hand is forbidden**.
Type entry points:

```ts
import type { components, operations, paths, Schema } from "@netdisk/api";
// Schema = components["schemas"] — all contract models
```

## 2. Using the Client

`Client` is the single REST entry point; it exposes only one method, `request`
(plus the raw `send`).

```ts
import { Client } from "@netdisk/api";

const c = new Client({
  getToken: () => this.token,          // inject the current access token
  onUnauthorized: () => this.refresh(), // silent-refresh callback on 401
});

// JSON request
const me = await c.request<Record<string, unknown>>("/api/v1/me");

// With query parameters
const res = await c.request<{ users: User[]; total: number }>(
  `/api/v1/admin/users?${new URLSearchParams({ limit: "20" }).toString()}`,
);

// Write request
await c.request("/api/v1/admin/departments", {
  method: "POST",
  body: { parent_id: "", name: "R&D" },
});
```

Key behaviors:

- **Token injection**: automatically adds `Authorization: Bearer <token>`.
- **401 silent refresh**: when `onUnauthorized` is set, it refreshes first, then **replays
  the original request once**.
- **Binary bodies**: `Blob`/`FormData`/`ArrayBuffer` are sent as-is, without forcibly
  setting `Content-Type` (to avoid chunked uploads being serialized into empty objects).
- **Structured errors**: any non-2xx throws `APIError` (see below).
- **Same-origin**: baseURL is empty by default, same-origin with the backend
  (`credentials: "same-origin"`).

The caller holds the token and refresh logic (in `stores/auth.ts`); the client only sends
and replays.

## 3. Error Model

All errors uniformly throw `APIError`; the caller branches on `code` and **never parses the
`message` text**:

```ts
import { APIError } from "@netdisk/api";

try {
  await c.request(...);
} catch (e) {
  if (e instanceof APIError) {
    // e.status    — HTTP status code
    // e.code      — business error code (e.g. account_conflict)
    // e.details   — structured extra info (e.g. conflicting field details.field)
    // e.requestId — request ID for troubleshooting
    // Convenience predicates:
    //   e.isAuthError     — status === 401
    //   e.isSpaceRevoked  — code ∈ {space_revoked, space_gone}
  }
}
```

## 4. Authentication & Tokens

The admin login flow lives in `apps/admin/src/stores/auth.ts`:

- Login passes `audience: "web"` (per-client audience; a mistake shows up as "login
  succeeds but all APIs return 403").
- Access token and refresh token are stored only in **sessionStorage** (safe on shared
  computers).
- On expiry, `refresh()` exchanges the refresh token for a new access token, backfills and
  replays the request on success; only on refresh failure does `logout()` return the user
  to the login page.
- The route guard does not navigate before `auth.ready`, avoiding a flicker on refresh; an
  unauthenticated user is sent to the login page preserving the original URL via the
  `redirect` query parameter.

## 5. API Overview

Phase-1 endpoints covered by the contract (full definitions in `DOC/api/openapi.yaml`):

| Category | Endpoints | Description |
|---|---|---|
| auth | `GET /api/v1/version`、`GET /api/v1/me` | Version, current user |
| auth | `POST /api/v1/auth/{login,refresh,logout}` | Login/refresh/logout |
| files | `GET /api/v1/files`、`files/dirs`、`files/{id}` | File/directory listing and detail |
| files | `files/{id}/content`、`move`、`copy`、`subtree-stats`、`share-to-space`、`lock` | Content/move/copy/stats/share/lock |
| upload | `POST /api/v1/upload/create`、`{id}`、`{id}/finish` | Chunked upload |
| sync | `GET /api/v1/changes`、`changes/head`、`sync/cursors` | Change feed/cursors |
| shares | `shares`、`shares/{id}`、`shares/{token}/meta`、`.../download` | Sharing |
| admin | `departments`、`departments/{id}` | Departments (admin) |
| admin | `spaces`、`spaces/{id}` etc. | Space list/detail management |
| admin | `admin/users`、`admin/departments`、`admin/spaces/{id}/freeze` etc. | User/department/space governance |

> The admin console currently consumes mainly: `auth/*`, `me`, `admin/users`,
> `admin/departments`, `admin/spaces` (including quota/freeze/revoke).

## 6. Contract Discipline

`pnpm lint:contract` (the core of `check:api`) enforces three rules to keep
"contract single-source" from being bypassed: **hand-written fetch is blocked**,
**hand-written same-named DTOs are blocked**, and **stale generated output is blocked**.
Full rules and pass/fail output are in the **06-Test Document "Contract Gate"**.
