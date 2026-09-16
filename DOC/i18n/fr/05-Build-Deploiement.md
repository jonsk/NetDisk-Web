# Build & déploiement

> Le flux complet, de zéro à un build complet et à l'intégration de l'artefact dans le
> serveur. Discipline directrice : **exécuter `pnpm build` avant de compiler Go** — sinon
> le serveur intègre un artefact obsolète (mauvaise version silencieuse).

## 1. Exigences d'environnement

| Outil | Version |
|---|---|
| Node.js | ≥ 20 (CI utilise 22) |
| pnpm | ≥ 9.15.9 (version exacte du lockfile recommandée) |
| Go | serveur (≥ 1.x) — pour intégrer l'artefact |

## 2. Installer les dépendances

```bash
pnpm install --frozen-lockfile
```

`--frozen-lockfile` garantit que les versions installées correspondent exactement à
`pnpm-lock.yaml` (CI fait de même).

## 3. Développement

```bash
pnpm dev:admin
```

Démarre le serveur de développement Vite (port **5174**), en faisant passer `/api` vers
`http://127.0.0.1:8080` (décidé par `server.proxy` dans `vite.config.ts` ; connexion directe
au serveur local, même forme d'origine que la production).

## 4. Build de production

```bash
pnpm build
```

Équivaut à `pnpm --filter @netdisk/admin build` (`vite build`) ; la sortie va vers
**`apps/admin/dist`**.

Comportements de build clés (`apps/admin/vite.config.ts`) :

- `base: "/admin/"` — les URLs des ressources commencent par le sous-chemin ;
- `outDir: "dist"`, `emptyOutDir: true` ;
- `target: "es2021"` — plancher navigateur (compatibilité avec les WebViews intégrées
  WeCom/DingTalk plus anciennes) ;
- sourcemaps désactivées en production (éviter d'expédier le code source/les chemins
  d'endpoints) ;
- les noms de fichiers des ressources portent des hachages de contenu
  (`assets/[name]-[hash].js`) → base du cache long.

## 5. Contrat & gates (recommandé avant le build)

```bash
pnpm gen:api       # régénérer les types après une modification du contrat
pnpm check:api     # gate de cohérence génération/contrat (diff bidirectionnel)
pnpm -r typecheck  # vérification de types de tout le dépôt
pnpm check:rules   # discipline frontend (7 règles)
```

CI exécute avant le build `check:api → typecheck → check:rules` ; tout échec devient rouge.

## 6. Intégrer l'artefact dans le serveur (étapes clés)

1. Dans `web-com`, exécuter `pnpm build` pour obtenir `apps/admin/dist` ;
2. copier `apps/admin/dist` vers le serveur `internal/webui/dist/admin/` (le nom du
   répertoire ne doit pas changer — `go:embed` en dépend) ;
3. puis compiler le binaire Go — après cela, `/admin` est servi par le `embed` du serveur,
   même origine que l'API.

> ⚠️ Ordre erroné (go build avant pnpm build) laisse le serveur intégrer l'ancien artefact
> admin ; vérifier que `/admin/index.html` est la nouvelle version avant la publication en
> production.

## 7. Référence rapide de la forme de déploiement

- Port unique : frontend et API sont servis tous deux à la même origine depuis le binaire
  Go (Nginx ne fait que TLS et routage ; il n'héberge pas de ressources statiques).
- Sous-chemin : admin est accroché à `/admin/` ; le fallback SPA est implémenté par le
  `webui.Handler` de Go, aucune réécriture supplémentaire.

> Les trois réglages « liés au déploiement » (Vite `base` / history / `outDir`) et leurs
> conséquences d'écran blanc sont détaillés dans 04-Architecture « Forme de déploiement ».

## 8. Vérifier l'artefact

```bash
# Vérification minimale que l'artefact peut être intégré (même que CI)
test -f apps/admin/dist/index.html || (echo "artefact admin manquant" && exit 1)
```
