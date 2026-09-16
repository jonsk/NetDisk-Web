# NetDisk Web · Web Frontend

> The admin-console frontend of the enterprise netdisk **NetDisk**. Vue 3 + TypeScript + pnpm workspace,
> sharing one set of API models across the server and desktop through an OpenAPI contract.

NetDisk is an enterprise-grade netdisk system: this repository is its **Web frontend (admin console)**, providing
IT administrators with governance for users/departments, spaces and quotas. File browsing and transfer happen in the desktop client;
this repository **deliberately does not implement online preview or file transfer** — that is a product boundary, not an unfinished item.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](../../../LICENSE)

---

## 🌐 Multi-language / Translations

| Language | README | Feature List | API Guide | Code Reading Guide | Architecture | Build & Deploy | Test |
|---|---|---|---|---|---|---|---|
| English | [README](README.md) | [Feature List](01-Feature-List.md) | [API Guide](02-API-Guide.md) | [Code Reading Guide](03-Code-Reading-Guide.md) | [Architecture](04-Architecture.md) | [Build & Deploy](05-Build-Deploy.md) | [Test](06-Test-Document.md) |
| Deutsch | [README](../de/README.md) | [Funktionsübersicht](../de/01-Funktionsuebersicht.md) | [API-Anleitung](../de/02-API-Anleitung.md) | [Code-Leseanleitung](../de/03-Code-Leseanleitung.md) | [Architektur](../de/04-Architektur.md) | [Build & Bereitstellung](../de/05-Build-Bereitstellung.md) | [Testdokument](../de/06-Testdokument.md) |
| Français | [README](../fr/README.md) | [Liste des fonctionnalités](../fr/01-Liste-Fonctionnalites.md) | [Guide API](../fr/02-Guide-API.md) | [Guide de lecture du code](../fr/03-Guide-Lecture.md) | [Architecture](../fr/04-Architecture.md) | [Build & Déploiement](../fr/05-Build-Deploiement.md) | [Document de test](../fr/06-Document-Test.md) |
| Suomi | [README](../fi/README.md) | [Ominaisuusluettelo](../fi/01-Ominaisuusluettelo.md) | [API-opas](../fi/02-API-opas.md) | [Koodin lukemisen opas](../fi/03-Koodin-lukemisen-opas.md) | [Arkkitehtuuri](../fi/04-Arkkitehtuuri.md) | [Rakennus ja käyttöönotto](../fi/05-Rakennus-ja-kayttoonotto.md) | [Testidokumentti](../fi/06-Testidokumentti.md) |
| Русский | [README](../ru/README.md) | [Список возможностей](../ru/01-Funkcionalnyj-spisok.md) | [Руководство API](../ru/02-Rukovodstvo-API.md) | [Руководство по чтению кода](../ru/03-Rukovodstvo-po-chteniyu.md) | [Архитектура](../ru/04-Arhitektura.md) | [Сборка и развёртывание](../ru/05-Sborka-i-razvertyvanie.md) | [Тестовая документация](../ru/06-Testovaya-dokumentaciya.md) |

---

## ✨ Features

- **Admin console (`apps/admin`)** — admin-only: login / overview / users & departments / space governance,
  built on [Naive UI](https://www.naiveui.com).
- **Single-source contract** — all API models shared between frontend and backend are generated from `DOC/api/openapi.yaml`;
  a two-way diff gate ensures the generated artifacts never drift from the contract.
- **Unified API client (`packages/api`)** — typed REST client with built-in structured errors,
  token injection and silent 401 refresh; **hand-written fetch is forbidden by a static gate**, all requests converge here.
- **Engineering gates (`scripts/`)** — contract consistency and frontend discipline (audience-per-branch / token storage / guards /
  silent refresh, 7 rules) are zero-dependency static checks that run directly in CI.
- **Embeddable deployment** — artifacts are copied into the server after `pnpm build` and served via Go `embed`, same-origin single port.

## 🧰 Tech Stack

| Area | Choice |
|---|---|
| Framework | Vue 3 (Composition API / `<script setup>`) |
| Build | Vite 5 |
| State | Pinia |
| UI | Naive UI |
| Routing | Vue Router 4 (History mode, mounted under `/admin/` sub-path) |
| Types | TypeScript (strict), vue-tsc |
| Package manager | pnpm (workspace, ≥9.15.9) |
| Contract | openapi-typescript (OpenAPI 3.1) |

## 📦 Quick Start

Requirements: Node ≥ 20, pnpm ≥ 9.15.9.

```bash
# Install dependencies (exact versions from the lockfile)
pnpm install --frozen-lockfile

# Development (Vite dev server, /api proxied to http://127.0.0.1:8080)
pnpm dev:admin

# Production build (outputs to apps/admin/dist, for the server to embed-copy)
pnpm build

# Type check / contract gate / frontend discipline
pnpm -r typecheck
pnpm check:api
pnpm check:rules
```

## 🔁 Common Commands

```bash
pnpm dev:admin     # start the admin development server (port 5174)
pnpm build         # build the admin console
pnpm typecheck     # type-check the whole repo
pnpm lint          # lint the whole repo
pnpm gen:api       # regenerate TS types from openapi.yaml
pnpm gen:csharp    # (optional) generate desktop C# models from the contract
pnpm check:api     # contract artifact consistency gate (two-way diff)
pnpm lint:contract # contract lint: forbid hand-written fetch / same-name DTO
pnpm check:rules   # frontend discipline static check (7 rules)
```

## 📁 Repository Structure

```
.
├─ apps/admin/          # admin console (login/overview/users-departments/space governance)
│  └─ src/
│     ├─ layouts/       #   AdminLayout: sidebar + topbar
│     ├─ router/        #   routes & guards
│     ├─ stores/        #   Pinia state (auth store)
│     └─ views/         #   page views
├─ packages/api/        # contract-generated base library (types + REST client + error model)
├─ scripts/             # engineering gate scripts
├─ DOC/                 # project docs + OpenAPI contract (DOC/api/openapi.yaml)
```

## 📚 Documentation

| No. | Document | Description |
|---|---|---|
| 01 | [DOC/01-功能清单.md](../../../DOC/01-功能清单.md) | feature list by module |
| 02 | [DOC/02-API指南.md](../../../DOC/02-API指南.md) | contract & API client guide |
| 03 | [DOC/03-代码阅读指南.md](../../../DOC/03-代码阅读指南.md) | directory tour & code organization |
| 04 | [DOC/04-架构设计文档.md](../../../DOC/04-架构设计文档.md) | architecture decisions & design |
| 05 | [DOC/05-编译与部署.md](../../../DOC/05-编译与部署.md) | build, artifact embedding & deployment |
| 06 | [DOC/06-测试文档.md](../../../DOC/06-测试文档.md) | testing strategy & gates |

> 🌐 Multi-language translations of the above documents are in the "Multi-language / Translations" table at the top.

## 🔐 Contract & Collaboration

The single source of truth for the interface contract is `Doc/api/openapi.yaml` in the server repo; this repo keeps a
vendored copy at `DOC/api/openapi.yaml` (three places must stay in sync: server / web / desktop).
Any interface change must:
1. modify the authoritative contract;
2. run `pnpm gen:api` to regenerate types;
3. pass the `pnpm check:api` two-way diff gate.

Never hand-edit the generated artifact `packages/api/src/schema.gen.ts`.

## 🚀 CI

`.github/workflows/ci.yml` runs on push/PR to `master`/`main`:
`pnpm install --frozen-lockfile → check:api → typecheck → check:rules → build →`
verify `apps/admin/dist/index.html` exists (ensuring the artifact can be embedded).

## 📄 License

[Apache License 2.0](../../../LICENSE) · Copyright © 2026 NetDisk Contributors
