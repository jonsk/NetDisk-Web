# Guide API

> La **seule** façon pour le frontend d'appeler le serveur est via le client typé fourni
> par `packages/api`. Le `fetch` écrit à la main est interdit par un gate statique
> (voir « Discipline du contrat » ci-dessous).

## Sommaire

1. [Source unique du contrat](#1-source-unique-du-contrat)
2. [Utilisation du client](#2-utilisation-du-client)
3. [Modèle d'erreur](#3-modele-derreur)
4. [Authentification & jetons](#4-authentification--jetons)
5. [Aperçu de l'API](#5-apercu-de-lapi)
6. [Discipline du contrat](#6-discipline-du-contrat)

---

## 1. Source unique du contrat

Le contrat d'interface faisant autorité se trouve dans le dépôt serveur à
`Doc/api/openapi.yaml` ; ce dépôt conserve une copie à `DOC/api/openapi.yaml`. À chaque
modification du contrat :

```bash
pnpm gen:api        # régénérer les types TS vers packages/api/src/schema.gen.ts
pnpm check:api      # gate de diff bidirectionnel : la génération doit correspondre au contrat
```

`packages/api/src/schema.gen.ts` est **une sortie générée — la modifier à la main est
interdit**. Points d'entrée de types :

```ts
import type { components, operations, paths, Schema } from "@netdisk/api";
// Schema = components["schemas"] — tous les modèles du contrat
```

## 2. Utilisation du client

`Client` est le point d'entrée REST unique ; il n'expose qu'une seule méthode, `request`
(plus le `send` brut).

```ts
import { Client } from "@netdisk/api";

const c = new Client({
  getToken: () => this.token,          // injecter le jeton d'accès courant
  onUnauthorized: () => this.refresh(), // rappel d'actualisation silencieuse sur 401
});

// Requête JSON
const me = await c.request<Record<string, unknown>>("/api/v1/me");

// Avec des paramètres de requête
const res = await c.request<{ users: User[]; total: number }>(
  `/api/v1/admin/users?${new URLSearchParams({ limit: "20" }).toString()}`,
);

// Requête d'écriture
await c.request("/api/v1/admin/departments", {
  method: "POST",
  body: { parent_id: "", name: "R&D" },
});
```

Comportements clés :

- **Injection de jeton** : ajoute automatiquement `Authorization: Bearer <token>`.
- **Actualisation silencieuse sur 401** : avec `onUnauthorized`, actualise d'abord, puis
  **rejoue une fois** la requête d'origine.
- **Corps binaires** : `Blob`/`FormData`/`ArrayBuffer` sont envoyés tels quels, sans
  forcer `Content-Type` (pour éviter que les uploads en morceaux soient sérialisés en
  objets vides).
- **Erreurs structurées** : tout non-2xx lève `APIError` (voir ci-dessous).
- **Même origine** : baseURL vide par défaut, même origine que le backend
  (`credentials: "same-origin"`).

L'appelant détient le jeton et la logique d'actualisation (dans `stores/auth.ts`) ; le
client ne fait qu'envoyer et rejouer.

## 3. Modèle d'erreur

Toutes les erreurs lèvent uniformément `APIError` ; l'appelant se branche sur `code` et
**ne parse jamais le texte `message`** :

```ts
import { APIError } from "@netdisk/api";

try {
  await c.request(...);
} catch (e) {
  if (e instanceof APIError) {
    // e.status    — code de statut HTTP
    // e.code      — code d'erreur métier (ex. account_conflict)
    // e.details   — infos structurées supplémentaires (ex. champ conflictuel details.field)
    // e.requestId — ID de requête pour le dépannage
    // Prédicats pratiques :
    //   e.isAuthError     — status === 401
    //   e.isSpaceRevoked  — code ∈ {space_revoked, space_gone}
  }
}
```

## 4. Authentification & jetons

Le flux de connexion admin se trouve dans `apps/admin/src/stores/auth.ts` :

- La connexion passe `audience: "web"` (audience par client ; une erreur se manifeste par
  « la connexion réussit mais toutes les API renvoient 403 »).
- Le jeton d'accès et le jeton d'actualisation sont stockés uniquement en
  **sessionStorage** (sûr sur les ordinateurs partagés).
- À l'expiration, `refresh()` échange le jeton d'actualisation contre un nouveau jeton
  d'accès ; en cas de succès, il remplit et rejoue la requête ; ce n'est qu'en cas d'échec
  que `logout()` renvoie l'utilisateur à la page de connexion.
- Le garde de route ne navigue pas avant `auth.ready` (évite un scintillement au
  rafraîchissement) ; un utilisateur non authentifié est envoyé à la page de connexion en
  préservant l'URL d'origine via le paramètre de requête `redirect`.

## 5. Aperçu de l'API

Endpoints de la phase 1 couverts par le contrat (définitions complètes dans
`DOC/api/openapi.yaml`) :

| Catégorie | Endpoints | Description |
|---|---|---|
| auth | `GET /api/v1/version`、`GET /api/v1/me` | Version, utilisateur courant |
| auth | `POST /api/v1/auth/{login,refresh,logout}` | Connexion/actualisation/déconnexion |
| files | `GET /api/v1/files`、`files/dirs`、`files/{id}` | Liste fichiers/répertoires et détail |
| files | `files/{id}/content`、`move`、`copy`、`subtree-stats`、`share-to-space`、`lock` | Contenu/déplacer/copier/stats/partager/verrou |
| upload | `POST /api/v1/upload/create`、`{id}`、`{id}/finish` | Upload en morceaux |
| sync | `GET /api/v1/changes`、`changes/head`、`sync/cursors` | Flux de changements/curseurs |
| shares | `shares`、`shares/{id}`、`shares/{token}/meta`、`.../download` | Partage |
| admin | `departments`、`departments/{id}` | Départements (admin) |
| admin | `spaces`、`spaces/{id}` etc. | Gestion de la liste/détail des espaces |
| admin | `admin/users`、`admin/departments`、`admin/spaces/{id}/freeze` etc. | Gouvernance utilisateurs/départements/espaces |

> La console admin consomme actuellement principalement : `auth/*`, `me`, `admin/users`,
> `admin/departments`, `admin/spaces` (incl. quota/freeze/revoke).

## 6. Discipline du contrat

`pnpm lint:contract` (le cœur de `check:api`) impose trois règles pour que la « source
unique du contrat » ne soit pas contournée : **le fetch écrit à la main est bloqué**,
**les DTO homonymes écrits à la main sont bloqués** et **la génération obsolète est
bloquée**. Règles complètes et sortie de succès/échec dans le **06-Document de test « Gate
du contrat »**.
