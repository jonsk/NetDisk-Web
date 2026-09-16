# Document d'architecture

> Consigne les décisions d'architecture et les conventions de conception de ce dépôt
> (frontend web). Le contrat, la disposition, la cible de build et le backend sont
> étroitement couplés.

## 1. Forme du dépôt

- **Workspace pnpm à cible de build unique** : `apps/*` + `packages/*`.
- L'édition communautaire ne conserve que la console admin ; pas de workspace H5, pas
  d'intégration IdP, pas de journaux d'audit.
- Le contrat est **fourni** dans ce dépôt à `DOC/api/openapi.yaml` (source faisant
  autorité dans le dépôt serveur ; trois endroits à synchroniser : serveur / web /
  desktop).

## 2. Choix technologiques (décisions clés)

| Aspect | Choix | Raison |
|---|---|---|
| Framework | Vue 3 (`<script setup>`) | Composition, écosystème mature |
| Build | Vite 5 | Rapide, artefacts hachables |
| État | Pinia | Recommandé pour Vue 3 |
| UI | Naive UI | Compatible TS, à la demande |
| Router | Vue Router 4 (History) | Fonctionne avec le fallback SPA Go |
| Types | TS strict + vue-tsc | Discipline verrouillée par les gates |
| Gestionnaire de paquets | pnpm | Workspace + dépendances strictes |
| Contrat | openapi-typescript | Source unique générant des modèles multi-ends |
| Chaîne d'outils | node ≥ 20, pnpm ≥ 9.15.9 | CI conforme au local |

## 3. Forme de déploiement (frontend intégrable)

Le frontend **n'a pas de serveur statique autonome** : l'artefact de build est copié via
`pnpm build` dans le serveur `internal/webui/dist/` et servi par Go `embed`, même origine,
port unique.

Cela produit trois réglages **liés au déploiement** (les modifier vide l'application) :

1. **Vite `base: "/admin/"`** : le frontend est accroché au sous-chemin `/admin` ; les URLs
   des ressources doivent commencer par celui-ci, sinon 404 (écran blanc + une pile de 404
   dans la console).
2. **`createWebHistory("/admin/")`** correspond à `base` ; Go implémente déjà le fallback
   SPA.
3. **`outDir: "dist"`** : le nom du répertoire ne doit pas changer, sinon `go:embed` ne le
   trouve pas ; le script gen copie `web/apps/admin/dist` vers
   `server/internal/webui/dist/admin`.

**Discipline d'ordre de build** : exécuter `pnpm build` avant de compiler Go — sinon le
serveur intègre un artefact obsolète (mauvaise version silencieuse).

## 4. Mécanisme de source unique du contrat

```
DOC/api/openapi.yaml
        │  pnpm gen:api (openapi-typescript)
        ▼
packages/api/src/schema.gen.ts   ← sortie générée, ne pas modifier à la main
        │  pnpm check:api (lint-contract --check-generated, diff bidirectionnel)
        ▼
        tous les modèles du contrat / tous les types d'interface
```

- Les points d'entrée de types `Schema` / `Operations` / `Paths` proviennent tous de la
  génération.
- Les trois contraintes strictes de `lint:contract` (fetch écrit à la main, DTO homonymes
  écrits à la main, génération obsolète) forcent les requêtes à converger vers le client,
  empêchant de contourner la « source unique du contrat » (détails d'implémentation dans
  06-Document de test « Gate du contrat »).
- `gen-csharp` génère les modèles C# de bureau à partir du même contrat, gardant les
  compréhensions multi-ends cohérentes.

## 5. Responsabilités des modules & couches

```
views/ (pages : connexion/vue d'ensemble/utilisateurs & départements/gouvernance des espaces)
   │  via auth.client()
   ▼
stores/auth.ts (état d'auth : connexion/actualisation/déconnexion/jeton) — détient le jeton & la logique d'actualisation
   │
   ▼
packages/api (Client/APIError/types) — le seul endroit où fetch peut apparaître
   │
   ▼
API REST du serveur (définie par le contrat)
```

Principes :

- les pages ne construisent jamais de requêtes à la main — toujours via `auth.client()` ;
- la détention du jeton et l'actualisation vivent dans le store ; le client ne fait
  qu'envoyer et rejouer ;
- les erreurs sont uniformément `APIError`, branchées par `code`.

## 6. Limites des pages (décisions produit)

- **Console web = gouvernance globale** : créer des espaces/inviter des membres/partir se
  font dans le client de bureau ; la console ne les fournit pas (évite un point d'entrée
  supplémentaire peu clair dans le modèle d'autorisations).
- **Aucune prévisualisation en ligne** (images/PDF/Office) ; opérations sur fichiers dans
  le client de bureau.
- Utilisation en lecture seule ; le seuil d'alerte est une ligne de rappel, pas une
  limite ; **retrait ≠ suppression** (les fichiers ne sont pas supprimés ; uniquement gel +
  suppression des membres).

## 7. Discipline frontend (check:rules)

La console admin impose 7 règles de discipline (R1~R7) via
`scripts/check-frontend-rules.mjs` : audience par client, stockage des jetons, gardes
préservant l'URL d'origine, actualisation silencieuse & rejeu sur 401, ordre de
restauration à l'entrée, API protégées via le client, et aucune globale de SDK plateforme.
Chaque règle a un contre-contrôle « casser → rouge ». Règles complètes et conséquences
dans le **06-Document de test « Discipline frontend »**.

## 8. CI

`.github/workflows/ci.yml` exécute la chaîne de gates sur push/PR (master/main) et vérifie
que l'artefact admin peut être intégré ; `gen-csharp` (modèles de bureau) appartient au
dépôt desktop après la scission. Ordre complet des gates dans le **06-Document de test
« Aperçu des gates automatisés »**.
