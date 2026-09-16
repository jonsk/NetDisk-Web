# Code Reading Guide

> For developers entering this repository for the first time: an introduction to the
> directory layout, entry assembly order, and the responsibility of each file.

## Directory Tour

```
web-com/
├─ apps/admin/            # Admin console app (production build target)
│  └─ src/
│     ├─ main.ts          # Entry: assemble store → router → naive → mount
│     ├─ App.vue          # Root component: config provider + router outlet
│     ├─ env.d.ts         # Vite client environment types
│     ├─ layouts/
│     │  └─ AdminLayout.vue  # Sidebar + top bar + router outlet + logout
│     ├─ router/
│     │  └─ index.ts         # Route table + before/after guards
│     ├─ stores/
│     │  └─ auth.ts          # Auth state: login/refresh/logout/token persistence
│     └─ views/
│        ├─ LoginView.vue    # Login page
│        ├─ OverviewView.vue # Overview (current session)
│        ├─ UsersView.vue    # Users & departments management
│        └─ SpacesView.vue   # Space governance
├─ packages/api/          # Contract-generated base library (pure TS, no runtime deps)
│  └─ src/
│     ├─ schema.gen.ts    # Generated file: all contract types (do NOT edit)
│     └─ index.ts         # Client / APIError / type aliases
├─ scripts/               # Engineering gate scripts
│  ├─ lint-contract.mjs       # Contract lint + bidirectional diff
│  ├─ check-frontend-rules.mjs # Frontend discipline (7 rules)
│  └─ gen-csharp.mjs          # Desktop C# model generation hook
├─ DOC/api/openapi.yaml  # Vendored contract copy
├─ DOC/                   # Project docs
├─ pnpm-workspace.yaml    # Workspace definition (apps/* + packages/*)
├─ tsconfig.base.json     # Shared TS compile config
└─ package.json           # Root scripts
```

## Entry Assembly Order (`main.ts`)

The order is deliberate; reversing it causes "redirected to login on every refresh":

1. `createApp` + `createPinia`, register pinia;
2. `useAuthStore(pinia)` then call **`auth.restore()`** (restore the token from
   sessionStorage; reads local storage only, no network request);
3. `app.use(router)` (guards read `auth.ready` / `auth.token`);
4. `app.use(naive)`, `app.mount("#app")`.

> **Why `restore()` must precede `use(router)`**: if the route guard sees "not logged in"
> on the first navigation (even though the token exists), the user gets bounced to the
> login page on every refresh, with a flicker.

## Routes & Guards (`router/index.ts`)

- `createWebHistory("/admin/")`: must match Vite's `base: "/admin/"`; using hash routing
  degrades to `/admin/#/users`, conflicting with the SPA fallback already implemented in Go.
- `beforeEach` guard:
  - `meta.public` (login page) passes through;
  - no token → go to login, **preserving the original URL** via `redirect: to.fullPath`;
  - has token → pass.
- `afterEach` guard: sets `document.title` from `meta.title`.
- Catch-all route `/:pathMatch(.*)*` redirects to `/overview` (avoids a blank "system
  broken" page).

## Auth Store (`stores/auth.ts`)

Three core discipline rules (each maps to a real failure; see the file header comment):

1. `audience: "web"` explicitly;
2. token only in `sessionStorage`;
3. silent refresh and replay on expiry; logout only on refresh failure.

`client()` returns a shared client wired with `getToken` + `onUnauthorized`;
`refresh()` deliberately **does not throw** but returns `string|null`, letting the client
decide whether "this 401 can be salvaged".

## REST Client (`packages/api/src/index.ts`)

- **Exposes only `request`** (plus raw `send`): error handling/refresh/headers have a
  single implementation, so the client does not balloon as APIs grow.
- Types **all come from the contract** (`schema.gen.ts`); this file does not hand-write
  same-named types.
- `APIError` is the only thrown error type; branch on `code`.
- `isBinaryBody`: `Blob`/`FormData`/`ArrayBuffer` sent as-is, avoiding chunked uploads
  being JSON-serialized.

## Gate Scripts (`scripts/`)

- `lint-contract.mjs`: contract gate — hand-written fetch, same-named DTOs, stale generated
  output.
- `check-frontend-rules.mjs`: frontend discipline (R1~R7), catching only silent-wrongness
  points.
- `gen-csharp.mjs`: maps the contract to C# models; when `desktop/` does not exist, only
  validates the chain and exits 0.

> Full rules, consequences, and pass/fail output for each gate are in the 06-Test Document.

## Reading Suggestions

1. Walk the auth loop from `main.ts` → `router` → `stores/auth.ts`;
2. Read `packages/api/src/index.ts` to understand request/error/refresh;
3. Look through `views/` to see how `auth.client()` calls APIs;
4. To change an API, first change the contract → `pnpm gen:api` → `pnpm check:api`.
