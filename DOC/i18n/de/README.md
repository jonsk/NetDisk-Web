# NetDisk Web · Web-Frontend

> Das Admin-Konsolen-Frontend des Unternehmens-Netdisks **NetDisk**. Vue 3 + TypeScript + pnpm workspace,
> das über einen OpenAPI-Vertrag ein gemeinsames API-Modell mit Server und Desktop teilt.

NetDisk ist ein Enterprise-Netdisk-System: Dieses Repository ist sein **Web-Frontend (Admin-Konsole)**, das
IT-Administratoren die Verwaltung von Benutzern/Abteilungen, Räumen und Kontingenten bietet. Das Durchsuchen und Übertragen von Dateien erfolgt im Desktop-Client;
dieses Repository **implementiert bewusst keine Online-Vorschau und keine Dateiübertragung** — das ist eine Produktgrenze, kein unfertiges Feature.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](../../../LICENSE)

---

## 🌐 Mehrsprachig / Übersetzungen

| Sprache | README | Funktionsübersicht | API-Anleitung | Code-Leseanleitung | Architektur | Build & Bereitstellung | Test |
|---|---|---|---|---|---|---|---|
| English | [README](../en/README.md) | [Feature List](../en/01-Feature-List.md) | [API Guide](../en/02-API-Guide.md) | [Code Reading Guide](../en/03-Code-Reading-Guide.md) | [Architecture](../en/04-Architecture.md) | [Build & Deploy](../en/05-Build-Deploy.md) | [Test](../en/06-Test-Document.md) |
| Deutsch | [README](README.md) | [Funktionsübersicht](01-Funktionsuebersicht.md) | [API-Anleitung](02-API-Anleitung.md) | [Code-Leseanleitung](03-Code-Leseanleitung.md) | [Architektur](04-Architektur.md) | [Build & Bereitstellung](05-Build-Bereitstellung.md) | [Testdokument](06-Testdokument.md) |
| Français | [README](../fr/README.md) | [Liste des fonctionnalités](../fr/01-Liste-Fonctionnalites.md) | [Guide API](../fr/02-Guide-API.md) | [Guide de lecture du code](../fr/03-Guide-Lecture.md) | [Architecture](../fr/04-Architecture.md) | [Build & Déploiement](../fr/05-Build-Deploiement.md) | [Document de test](../fr/06-Document-Test.md) |
| Suomi | [README](../fi/README.md) | [Ominaisuusluettelo](../fi/01-Ominaisuusluettelo.md) | [API-opas](../fi/02-API-opas.md) | [Koodin lukemisen opas](../fi/03-Koodin-lukemisen-opas.md) | [Arkkitehtuuri](../fi/04-Arkkitehtuuri.md) | [Rakennus ja käyttöönotto](../fi/05-Rakennus-ja-kayttoonotto.md) | [Testidokumentti](../fi/06-Testidokumentti.md) |
| Русский | [README](../ru/README.md) | [Список возможностей](../ru/01-Funkcionalnyj-spisok.md) | [Руководство API](../ru/02-Rukovodstvo-API.md) | [Руководство по чтению кода](../ru/03-Rukovodstvo-po-chteniyu.md) | [Архитектура](../ru/04-Arhitektura.md) | [Сборка и развёртывание](../ru/05-Sborka-i-razvertyvanie.md) | [Тестовая документация](../ru/06-Testovaya-dokumentaciya.md) |

---

## ✨ Funktionen

- **Admin-Konsole (`apps/admin`)** — nur für Verwaltung: Login / Übersicht / Benutzer & Abteilungen / Raumverwaltung,
  basierend auf [Naive UI](https://www.naiveui.com).
- **Einzige Vertragsquelle** — alle zwischen Frontend und Backend geteilten API-Modelle werden aus `DOC/api/openapi.yaml` generiert;
  ein zweiseitiger Diff-Gate stellt sicher, dass die erzeugten Artefakte nie vom Vertrag abweichen.
- **Einheitlicher API-Client (`packages/api`)** — typisierter REST-Client mit eingebauten strukturierten Fehlern,
  Token-Injektion und stillem 401-Refresh; **handgeschriebenes fetch ist durch ein statisches Gate verboten**, alle Requests laufen hier zusammen.
- **Engineering-Gates (`scripts/`)** — Vertragskonsistenz und Frontend-Disziplin (Audience pro Zweig / Token-Speicherung / Guards /
  stiller Refresh, 7 Regeln) sind zustandslose statische Checks, die direkt in CI laufen.
- **Einbettbare Bereitstellung** — Artefakte werden nach `pnpm build` in den Server kopiert und über Go `embed` ausgeliefert, gleiche Quelle, ein Port.

## 🧰 Tech-Stack

| Bereich | Wahl |
|---|---|
| Framework | Vue 3 (Composition API / `<script setup>`) |
| Build | Vite 5 |
| State | Pinia |
| UI | Naive UI |
| Routing | Vue Router 4 (History-Modus, unter `/admin/`-Teilpfad) |
| Typen | TypeScript (strict), vue-tsc |
| Paketmanager | pnpm (workspace, ≥9.15.9) |
| Vertrag | openapi-typescript (OpenAPI 3.1) |

## 📦 Schnellstart

Voraussetzungen: Node ≥ 20, pnpm ≥ 9.15.9.

```bash
# Abhängigkeiten installieren (exakte Versionen aus dem Lockfile)
pnpm install --frozen-lockfile

# Entwicklung (Vite-Dev-Server, /api proxied nach http://127.0.0.1:8080)
pnpm dev:admin

# Produktions-Build (Ausgabe nach apps/admin/dist, für den Embed-Copy des Servers)
pnpm build

# Typprüfung / Vertrags-Gate / Frontend-Disziplin
pnpm -r typecheck
pnpm check:api
pnpm check:rules
```

## 🔁 Häufige Befehle

```bash
pnpm dev:admin     # Admin-Entwicklungsserver starten (Port 5174)
pnpm build         # Admin-Konsole bauen
pnpm typecheck     # Typprüfung des gesamten Repos
pnpm lint          # Lint des gesamten Repos
pnpm gen:api       # TS-Typen aus openapi.yaml neu generieren
pnpm gen:csharp    # (optional) Desktop-C#-Modelle aus dem Vertrag generieren
pnpm check:api     # Vertrags-Artefakt-Konsistenz-Gate (zweiseitiger Diff)
pnpm lint:contract # Vertrags-Lint: handgeschriebenes fetch / gleichnamige DTO verbieten
pnpm check:rules   # Frontend-Disziplin statischer Check (7 Regeln)
```

## 📁 Repo-Struktur

```
.
├─ apps/admin/          # Admin-Konsole (Login/Übersicht/Benutzer-Abteilungen/Raumverwaltung)
│  └─ src/
│     ├─ layouts/       #   AdminLayout: Sidebar + Topbar
│     ├─ router/        #   Routen & Guards
│     ├─ stores/        #   Pinia-State (Auth-Store)
│     └─ views/         #   Seiten-Views
├─ packages/api/        # vertragsgenerierte Basisbibliothek (Typen + REST-Client + Fehlermodell)
├─ scripts/             # Engineering-Gate-Skripte
├─ DOC/                 # Projektdokumentation + OpenAPI-Vertrag (DOC/api/openapi.yaml)
```

## 📚 Dokumentation

| Nr. | Dokument | Beschreibung |
|---|---|---|
| 01 | [DOC/01-功能清单.md](../../../DOC/01-功能清单.md) | Funktionsliste nach Modul |
| 02 | [DOC/02-API指南.md](../../../DOC/02-API指南.md) | Vertrag & API-Client-Anleitung |
| 03 | [DOC/03-代码阅读指南.md](../../../DOC/03-代码阅读指南.md) | Verzeichnis-Tour & Code-Organisation |
| 04 | [DOC/04-架构设计文档.md](../../../DOC/04-架构设计文档.md) | Architekturentscheidungen & Design |
| 05 | [DOC/05-编译与部署.md](../../../DOC/05-编译与部署.md) | Build, Artefakt-Einbettung & Bereitstellung |
| 06 | [DOC/06-测试文档.md](../../../DOC/06-测试文档.md) | Teststrategie & Gates |

> 🌐 Mehrsprachige Übersetzungen der obigen Dokumente finden Sie in der Tabelle „Mehrsprachig / Übersetzungen" oben.

## 🔐 Vertrag & Zusammenarbeit

Die einzige Wahrheitsquelle des Schnittstellen-Vertrags ist `Doc/api/openapi.yaml` im Server-Repo; dieses Repo hält eine
Vendored-Kopie unter `DOC/api/openapi.yaml` (drei Stellen müssen synchron bleiben: Server / Web / Desktop).
Jede Schnittstellenänderung muss:
1. den maßgeblichen Vertrag ändern;
2. `pnpm gen:api` ausführen, um Typen neu zu generieren;
3. das `pnpm check:api`-Diff-Gate bestehen.

Das generierte Artefakt `packages/api/src/schema.gen.ts` niemals von Hand bearbeiten.

## 🚀 CI

`.github/workflows/ci.yml` läuft bei Push/PR auf `master`/`main`:
`pnpm install --frozen-lockfile → check:api → typecheck → check:rules → build →`
überprüft, ob `apps/admin/dist/index.html` existiert (sichert, dass das Artefakt eingebettet werden kann).

## 📄 Lizenz

[Apache License 2.0](../../../LICENSE) · Copyright © 2026 NetDisk Contributors
