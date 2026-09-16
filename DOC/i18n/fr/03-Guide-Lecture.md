# Guide de lecture du code

> Pour les développeurs qui arrivent pour la première fois dans ce dépôt : introduction à
> l'organisation des répertoires, à l'ordre d'assemblage et à la responsabilité de chaque
> fichier.

## Tour des répertoires

```
web-com/
├─ apps/admin/            # Application console admin (cible de build de prod)
│  └─ src/
│     ├─ main.ts          # Entrée : assembler store → router → naive → mount
│     ├─ App.vue          # Composant racine : fournisseur de config + sortie du routeur
│     ├─ env.d.ts         # Types d'environnement client Vite
│     ├─ layouts/
│     │  └─ AdminLayout.vue  # Barre latérale + barre supérieure + sortie du routeur + déconnexion
│     ├─ router/
│     │  └─ index.ts         # Table de routes + gardes avant/après
│     ├─ stores/
│     │  └─ auth.ts          # État d'authentification : connexion/actualisation/déconnexion/persistance
│     └─ views/
│        ├─ LoginView.vue    # Page de connexion
│        ├─ OverviewView.vue # Vue d'ensemble (session courante)
│        ├─ UsersView.vue    # Gestion des utilisateurs & départements
│        └─ SpacesView.vue   # Gouvernance des espaces
├─ packages/api/          # Bibliothèque de base générée par contrat (TS pur, aucune dépendance d'exécution)
│  └─ src/
│     ├─ schema.gen.ts    # Fichier généré : tous les types du contrat (ne pas modifier)
│     └─ index.ts         # Client / APIError / alias de types
├─ scripts/               # Scripts de gates d'ingénierie
│  ├─ lint-contract.mjs       # Lint du contrat + diff bidirectionnel
│  ├─ check-frontend-rules.mjs # Discipline frontend (7 règles)
│  └─ gen-csharp.mjs          # Hook de génération des modèles C# de bureau
├─ DOC/api/openapi.yaml  # Copie du contrat
├─ DOC/                   # Documentation projet
├─ pnpm-workspace.yaml    # Définition du workspace (apps/* + packages/*)
├─ tsconfig.base.json     # Configuration de compilation TS partagée
└─ package.json           # Scripts racines
```

## Ordre d'assemblage de l'entrée (`main.ts`)

L'ordre est délibéré ; l'inverser provoque « redirigé vers la connexion à chaque
rafraîchissement » :

1. `createApp` + `createPinia`, enregistrer pinia ;
2. `useAuthStore(pinia)` puis appeler **`auth.restore()`** (restaurer le jeton depuis
   sessionStorage ; lecture locale uniquement, aucune requête réseau) ;
3. `app.use(router)` (les gardes lisent `auth.ready` / `auth.token`) ;
4. `app.use(naive)`, `app.mount("#app")`.

> **Pourquoi `restore()` doit précéder `use(router)`** : si le garde de route voit « non
> connecté » à la première navigation (bien que le jeton existe), l'utilisateur est
> renvoyé à la page de connexion à chaque rafraîchissement, avec scintillement.

## Routes & gardes (`router/index.ts`)

- `createWebHistory("/admin/")` : doit correspondre au `base: "/admin/"` de Vite ;
  l'utilisation du routage par hash dégrade vers `/admin/#/users`, en conflit avec le
  fallback SPA déjà implémenté en Go.
- Garde `beforeEach` :
  - `meta.public` (page de connexion) laisse passer ;
  - pas de jeton → aller à la connexion, **en préservant l'URL d'origine** via
    `redirect: to.fullPath` ;
  - avec jeton → laisser passer.
- Garde `afterEach` : définit `document.title` depuis `meta.title`.
- Route de rattrapage `/:pathMatch(.*)*` redirige vers `/overview` (évite une page vide
  « système en panne »).

## Store d'authentification (`stores/auth.ts`)

Trois règles de discipline centrales (chacune correspond à un vrai échec ; voir le
commentaire d'en-tête du fichier) :

1. `audience: "web"` explicitement ;
2. jeton uniquement en `sessionStorage` ;
3. actualisation silencieuse et rejeu à l'expiration ; déconnexion uniquement en cas
   d'échec de l'actualisation.

`client()` renvoie un client partagé câblé avec `getToken` + `onUnauthorized` ;
`refresh()` **ne lève délibérément aucune exception** mais renvoie `string|null`, ce qui
permet au client de décider si « ce 401 peut être récupéré ».

## Client REST (`packages/api/src/index.ts`)

- **N'expose que `request`** (plus le `send` brut) : gestion des erreurs/actualisation/
  en-têtes ont une seule implémentation, le client ne gonfle pas à mesure que les API
  grandissent.
- Les types **proviennent tous du contrat** (`schema.gen.ts`) ; ce fichier n'écrit pas de
  types homonymes à la main.
- `APIError` est le seul type d'erreur levé ; se brancher sur `code`.
- `isBinaryBody` : `Blob`/`FormData`/`ArrayBuffer` envoyés tels quels, évite que les uploads
  en morceaux soient sérialisés en JSON.

## Scripts de gates (`scripts/`)

- `lint-contract.mjs` : gate du contrat — fetch écrit à la main, DTO homonymes, génération
  obsolète.
- `check-frontend-rules.mjs` : discipline frontend (R1~R7), capture uniquement les erreurs
  silencieuses.
- `gen-csharp.mjs` : mappe le contrat vers des modèles C# ; si `desktop/` n'existe pas,
  valide seulement la chaîne et sort 0.

> Règles complètes, conséquences et sortie de succès/échec de chaque gate dans le
> 06-Document de test.

## Suggestions de lecture

1. Parcourir la boucle d'authentification de `main.ts` → `router` → `stores/auth.ts` ;
2. lire `packages/api/src/index.ts` pour comprendre requête/erreur/actualisation ;
3. parcourir `views/` pour voir comment `auth.client()` appelle les API ;
4. pour modifier une API, d'abord modifier le contrat → `pnpm gen:api` → `pnpm check:api`.
