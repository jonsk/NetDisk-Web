# Liste des fonctionnalités

> Ce dépôt est le **frontend web (console d'administration)** de NetDisk,
> Vue 3 + TypeScript + pnpm workspace.

## Objectif du dépôt

| Élément | Contenu |
|---|---|
| Nom | **web** (frontend NetDisk · édition communautaire) |
| Nature | Vue 3 + TypeScript + pnpm workspace ; cible de build unique `admin` |
| Stack | Vue 3 / Vite / Pinia / Naive UI / openapi-typescript |
| Consommateur | L'artefact de build est copié via `pnpm build` dans le serveur `internal/webui/dist/` et servi par Go `embed` |
| Contrat | Ce dépôt fournit une copie de `DOC/api/openapi.yaml` (source faisant autorité : `Doc/api/openapi.yaml`) |

**Sous-répertoires** : `apps/admin`, `packages/api`, `scripts`, `DOC`.

---

## A. Console d'administration (`apps/admin`) — administrateurs IT uniquement

| Page / Module | Fichier | Fonction |
|---|---|---|
| Connexion | `views/LoginView.vue` + `stores/auth.ts` | Connexion admin, stockage des jetons / actualisation silencieuse |
| Vue d'ensemble | `views/OverviewView.vue` | Infos de la session courante (utilisateur/rôle/audience/request_id) |
| Utilisateurs & départements | `views/UsersView.vue` | CRUD utilisateurs/départements, désactivation/activation, changement de rôle, dialogues de confirmation |
| Gouvernance des espaces | `views/SpacesView.vue` | Liste des espaces, quota/seuil d'alerte, gel, retrait |
| Cadre | `layouts/AdminLayout.vue` + `router/index.ts` | Layout, gardes de route (connexion/auth/URL d'origine) |

> **Limite de capacité (finalisée)** : aucune prévisualisation en ligne (images / PDF /
> Office) ; la navigation et le transfert de fichiers se font dans le client de bureau.
> La console web ne fait que de la **gouvernance globale** ; les entrées collaboratives
> telles que créer des espaces / inviter des membres se font dans le client de bureau.

### Détails par page

- **Connexion** : passe explicitement `audience: "web"` (audience par client), jeton dans
  `sessionStorage`, message d'échec de connexion unifié (ne distingue pas « utilisateur
  introuvable / mot de passe erroné »), 429 affiché séparément.
- **Vue d'ensemble** : n'affiche que l'utilisateur courant ; délibérément pas de
  graphiques de fausses données.
- **Utilisateurs & départements** : recherche/pagination côté serveur (pas de filtrage
  frontend), confirmation de désactivation (impact externe), erreurs de conflit d'unicité
  mappées sur les champs de saisie spécifiques, ajout/suppression de l'arborescence des
  départements.
- **Gouvernance des espaces** : l'utilisation est en lecture seule (modifiée uniquement par
  les transactions d'upload/suppression) ; le seuil d'alerte est une « ligne de rappel »,
  pas une limite (la limite de 95 % est une règle stricte côté serveur) ;
  **retrait ≠ suppression** (gel + suppression des membres, les fichiers ne sont PAS
  supprimés).

---

## B. Bibliothèques partagées (`packages/`)

- **`packages/api`** :
  - `src/schema.gen.ts` — types générés par OpenAPI (source unique du contrat,
    **ne pas modifier à la main**) ;
  - `src/index.ts` — client REST typé (fetch/DTO/injection de jeton/actualisation
    silencieuse), le seul endroit où `fetch(` peut apparaître.

---

## C. Gates d'ingénierie (`scripts/`)

- **`lint-contract.mjs`** (`check:api` / `lint:contract`) : gate du contrat — contraint le
  fetch écrit à la main, les DTO homonymes écrits à la main, et la génération obsolète
  (détails dans 06-Document de test « Gate du contrat »).
- **`check-frontend-rules.mjs`** (`check:rules`) : 7 règles de discipline frontend
  (R1~R7), chacune avec un contre-contrôle (détails dans 06-Document de test « Discipline
  frontend »).
- **`gen-csharp.mjs`** : hook de génération des modèles C# de bureau (si `desktop/`
  n'existe pas, valide seulement la chaîne et sort 0).

---

## D. Build & scripts (`package.json`)

`build` / `build:admin` / `dev:admin` / `typecheck` / `lint` / `gen:api` /
`gen:csharp` / `check:api` / `lint:contract` / `check:rules`
