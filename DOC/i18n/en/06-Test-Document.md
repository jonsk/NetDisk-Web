# Test Document

> This repository does **not** include a browser test runner. Instead, discipline that can
> be determined from text is turned into zero-dependency static gates that run directly in
> CI, and each rule can "break → turn red". Gates **cannot** replace manual acceptance
> (interaction, styling, real devices); the two complement each other.

## 1. Automated Gates Overview

| Gate | Command | What it does |
|---|---|---|
| Contract consistency | `pnpm check:api` | Bidirectional diff of generated output vs `openapi.yaml` + hand-written fetch/DTO lint |
| Contract lint | `pnpm lint:contract` | The lint part of the above |
| Type check | `pnpm -r typecheck` | vue-tsc / tsc strict-mode full-repo type check |
| Frontend discipline | `pnpm check:rules` | 7 static discipline rules |
| Build | `pnpm build` | Compile artifacts + verify `dist/index.html` exists |

**CI order** (`.github/workflows/ci.yml`):
`install(frozen) → check:api → typecheck → check:rules → build →` artifact check.

## 2. Contract Gate (`check:api` / `lint:contract`)

Script `scripts/lint-contract.mjs` guards against three ways "contract single-source" gets
silently broken:

1. **Hand-written fetch**: a `fetch(` outside `packages/api` fails — requests must converge
   into the client, so types/errors/refresh have one implementation.
2. **Hand-written same-named DTO**: `packages/api` must not `interface/type` with the same
   name as a generated model (instead write `export type X = Schema["X"]`, which follows
   the contract).
3. **Stale generated output** (`--check-generated`): regenerates and byte-compares with the
   committed output; a mismatch means the contract changed without regenerating, or the
   generated file was hand-edited.

Pass output: `Contract gate passed: fetch converged, no hand-written DTO, generated output
matches the contract.`

## 3. Frontend Discipline (`check:rules`)

Script `scripts/check-frontend-rules.mjs`, 7 discipline rules, each catching "doesn't
error but silently does the wrong thing":

| Rule | Check | Consequence if broken |
|---|---|---|
| R1 | admin login passes `audience="web"` | login succeeds but all APIs 403 |
| R2 | token only in sessionStorage (no localStorage) | management credentials linger on shared computers |
| R3 | guard redirects to login preserving the original URL (redirect) | user is sent home after login, losing the original page |
| R4 | 401 silent refresh and **replay once** (doFetch twice) | refresh without replay = request still fails |
| R5 | entry `auth.restore()` before mounting router | bounced to login on every refresh |
| R6 | protected APIs not opened via `href`/`window.open` | no token (401) / token into browser history |
| R7 | no direct platform SDK globals (wx/dd) | depends on injected platform objects, not pure web |

Implementation detail: `stripComments` strips comments before judging (to avoid false
positives from example strings in comments); each rule carries a reverse check (existence +
semantic double check).

Pass output: `All passed: 7 frontend discipline rules.`

## 4. Homepage Verification (`gen:csharp`)

Desktop C# model generation hook `scripts/gen-csharp.mjs`:
- always parses the contract and does the full mapping (the chain is constantly validated
  against the real contract);
- when `desktop/` does not exist, prints the skip reason and **exits 0** (does not turn red
  just because the desktop repo is absent);
- when it exists, writes `Generated/Models.g.cs` with byte comparison (usable as CI
  "contract changed → regenerate" gate).

## 5. Manual Acceptance Checklist

Parts the gates cannot cover, to be verified by hand:

- **Login loop**: login → overview; logout → back to login; refreshing the page does not
  bounce back.
- **Token-expiry silent refresh**: manually expire the access token, verify automatic
  401 refresh + replay and seamless recovery.
- **Guard behavior**: accessing a protected route unauthenticated → redirect to login with
  the original URL, and back to the original page after login.
- **Users/Departments**: create account, change role, disable (confirmation), unique-conflict
  error mapped to the input, server-side search pagination.
- **Space governance**: save quota/warning threshold, freeze/unfreeze, revoke (notify files
  are not deleted), usage read-only not hand-editable.
- **429 rate limiting**: too-frequent login failure prompts "please try again later".
- **Real devices/browser × resolutions**: desktop browsers primarily, plus older kernels.

> Interaction, styling, and real-device performance are outside the gates' reach; go
> through the "manual acceptance checklist" before merging.
