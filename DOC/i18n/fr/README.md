# NetDisk Web · Frontend Web

> Le frontend de la console d'administration du netdisk d'entreprise **NetDisk**. Vue 3 + TypeScript + pnpm workspace,
> partageant un même modèle d'API avec le serveur et le bureau via un contrat OpenAPI.

NetDisk est un système de netdisk d'entreprise : ce dépôt est son **frontend Web (console d'administration)**, offrant
aux administrateurs IT la gestion des utilisateurs/départements, des espaces et des quotas. La navigation et le transfert de fichiers se font dans le client de bureau ;
ce dépôt **n'implémente volontairement ni l'aperçu en ligne ni le transfert de fichiers** — c'est une frontière produit, pas une fonctionnalité inachevée.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](../../../LICENSE)

---

## 🌐 Multilingue / Traductions

[中文](../../../README.md) | [English](../en/README.md) | [Deutsch](../de/README.md) | [Français](../fr/README.md) | [Suomi](../fi/README.md) | [Русский](../ru/README.md)


---

## ✨ Fonctionnalités

- **Console d'administration (`apps/admin`)** — uniquement admin : connexion / aperçu / utilisateurs & départements / gouvernance des espaces,
  construite sur [Naive UI](https://www.naiveui.com).
- **Contrat à source unique** — tous les modèles d'API partagés entre frontend et backend sont générés à partir de `DOC/api/openapi.yaml` ;
  un gate de diff bidirectionnel garantit que les artefacts générés ne s'écartent jamais du contrat.
- **Client API unifié (`packages/api`)** — client REST typé avec erreurs structurées intégrées,
  injection de jeton et rafraîchissement silencieux 401 ; **le fetch écrit à la main est interdit par un gate statique**, toutes les requêtes convergent ici.
- **Gates d'ingénierie (`scripts/`)** — la cohérence du contrat et la discipline frontend (audience par branche / stockage du jeton / guards /
  rafraîchissement silencieux, 7 règles) sont des vérifications statiques sans dépendance, exécutables directement en CI.
- **Déploiement intégrable** — les artefacts sont copiés dans le serveur après `pnpm build` et servis via Go `embed`, même origine et un seul port.

## 🧰 Pile technique

| Domaine | Choix |
|---|---|
| Framework | Vue 3 (Composition API / `<script setup>`) |
| Build | Vite 5 |
| État | Pinia |
| UI | Naive UI |
| Routage | Vue Router 4 (mode History, monté sous le sous-chemin `/admin/`) |
| Types | TypeScript (strict), vue-tsc |
| Gestionnaire de paquets | pnpm (workspace, ≥9.15.9) |
| Contrat | openapi-typescript (OpenAPI 3.1) |

## 📦 Démarrage rapide

Prérequis : Node ≥ 20, pnpm ≥ 9.15.9.

```bash
# Installer les dépendances (versions exactes du lockfile)
pnpm install --frozen-lockfile

# Développement (serveur de dev Vite, /api proxifié vers http://127.0.0.1:8080)
pnpm dev:admin

# Build de production (sortie vers apps/admin/dist, pour que le serveur le copie en embed)
pnpm build

# Vérification des types / gate de contrat / discipline frontend
pnpm -r typecheck
pnpm check:api
pnpm check:rules
```

## 🔁 Commandes courantes

```bash
pnpm dev:admin     # démarrer le serveur de dev admin (port 5174)
pnpm build         # construire la console admin
pnpm typecheck     # vérifier les types de tout le dépôt
pnpm lint          # lint de tout le dépôt
pnpm gen:api       # régénérer les types TS depuis openapi.yaml
pnpm gen:csharp    # (optionnel) générer les modèles C# du bureau depuis le contrat
pnpm check:api     # gate de cohérence de l'artefact du contrat (diff bidirectionnel)
pnpm lint:contract # lint du contrat : interdire fetch écrit à la main / DTO homonyme
pnpm check:rules   # vérification statique de la discipline frontend (7 règles)
```

## 📁 Structure du dépôt

```
.
├─ apps/admin/          # console admin (connexion/aperçu/utilisateurs-départements/gouvernance des espaces)
│  └─ src/
│     ├─ layouts/       #   AdminLayout : sidebar + topbar
│     ├─ router/        #   routes & guards
│     ├─ stores/        #   état Pinia (store d'authentification)
│     └─ views/         #   vues de page
├─ packages/api/        # bibliothèque de base générée depuis le contrat (types + client REST + modèle d'erreur)
├─ scripts/             # scripts de gates d'ingénierie
├─ DOC/                 # docs du projet + contrat OpenAPI (DOC/api/openapi.yaml)
```

## 📚 Documentation

| N° | Document | Description |
|---|---|---|
| 01 | [DOC/01-功能清单.md](../../../DOC/01-功能清单.md) | liste des fonctionnalités par module |
| 02 | [DOC/02-API指南.md](../../../DOC/02-API指南.md) | guide du contrat & du client API |
| 03 | [DOC/03-代码阅读指南.md](../../../DOC/03-代码阅读指南.md) | visite du répertoire & organisation du code |
| 04 | [DOC/04-架构设计文档.md](../../../DOC/04-架构设计文档.md) | décisions d'architecture & design |
| 05 | [DOC/05-编译与部署.md](../../../DOC/05-编译与部署.md) | build, intégration de l'artefact & déploiement |
| 06 | [DOC/06-测试文档.md](../../../DOC/06-测试文档.md) | stratégie de test & gates |

> 🌐 Les traductions multilingues des documents ci-dessus figurent dans le tableau « Multilingue / Traductions » en haut.

## 🔐 Contrat & collaboration

La source unique de vérité du contrat d'interface est `Doc/api/openapi.yaml` dans le dépôt serveur ; ce dépôt conserve une
copie vendored sous `DOC/api/openapi.yaml` (trois endroits doivent rester synchronisés : serveur / web / bureau).
Toute modification d'interface doit :
1. modifier le contrat de référence ;
2. exécuter `pnpm gen:api` pour régénérer les types ;
3. passer le gate de diff bidirectionnel `pnpm check:api`.

Ne jamais modifier à la main l'artefact généré `packages/api/src/schema.gen.ts`.

## 🚀 CI

`.github/workflows/ci.yml` s'exécute sur push/PR vers `master`/`main` :
`pnpm install --frozen-lockfile → check:api → typecheck → check:rules → build →`
vérifie que `apps/admin/dist/index.html` existe (garantissant que l'artefact peut être intégré).

## 📄 Licence

[Apache License 2.0](../../../LICENSE) · Copyright © 2026 NetDisk Contributors