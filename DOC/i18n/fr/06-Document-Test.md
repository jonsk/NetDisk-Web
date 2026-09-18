# Document de test

> Ce dépôt **n'inclut pas** d'exécuteur de tests navigateur. À la place, les disciplines
> déterminables à partir du texte sont transformées en gates statiques sans dépendance qui
> s'exécutent directement en CI, et chaque règle peut « casser → rouge ». Les gates **ne
> peuvent pas** remplacer l'acceptation manuelle (interaction, style, appareils réels) ;
> les deux se complètent.

## 1. Aperçu des gates automatisés

| Gate | Commande | Ce qu'il fait |
|---|---|---|
| Cohérence du contrat | `pnpm check:api` | Diff bidirectionnel de la génération vs `openapi.yaml` + lint fetch/DTO écrit à la main |
| Lint du contrat | `pnpm lint:contract` | La partie lint du ci-dessus |
| Vérification de types | `pnpm -r typecheck` | Vérification de types vue-tsc/tsc en mode strict de tout le dépôt |
| Discipline frontend | `pnpm check:rules` | 7 règles de discipline statiques |
| Build | `pnpm build` | Compiler les artefacts + vérifier l'existence de `dist/index.html` |

**Ordre CI** (`.github/workflows/ci.yml`) :
`install(frozen) → check:api → typecheck → check:rules → build →` vérification de
l'artefact.

## 2. Gate du contrat (`check:api` / `lint:contract`)

Le script `scripts/lint-contract.mjs` protège contre trois façons de briser
silencieusement la « source unique du contrat » :

1. **fetch écrit à la main** : un `fetch(` hors de `packages/api` échoue — les requêtes
   doivent converger vers le client, pour que types/erreurs/actualisation aient une seule
   implémentation.
2. **DTO homonyme écrit à la main** : `packages/api` ne doit pas avoir de
   `interface/type` homonyme d'un modèle généré (écrire plutôt
   `export type X = Schema["X"]`, qui suit le contrat).
3. **Génération obsolète** (`--check-generated`) : régénérer et comparer octet par octet
   avec la sortie validée ; une différence signifie que le contrat a changé sans
   régénération, ou que la sortie générée a été éditée à la main.

Sortie de succès : `Gate du contrat réussi : fetch convergé, aucun DTO écrit à la main, la
génération correspond au contrat.`

## 3. Discipline frontend (`check:rules`)

Script `scripts/check-frontend-rules.mjs`, 7 règles de discipline, chacune capturant « ne
signale pas d'erreur mais fait silencieusement la mauvaise chose » :

| Règle | Vérification | Conséquence en cas de bris |
|---|---|---|
| R1 | La connexion admin passe `audience="web"` | la connexion réussit mais toutes les API renvoient 403 |
| R2 | jeton/identifiants uniquement en sessionStorage (pas de localStorage; sauf préférence de langue i18n) | les identifiants d'administration s'attardent sur les ordinateurs partagés |
| R3 | le garde redirige vers la connexion en préservant l'URL d'origine (redirect) | l'utilisateur est envoyé à l'accueil après connexion, perdant la page d'origine |
| R4 | 401 actualisation silencieuse et **rejeu une fois** (doFetch deux fois) | actualiser sans rejouer = la requête échoue toujours |
| R5 | entrée `auth.restore()` avant de monter le routeur | renvoyé à la connexion à chaque rafraîchissement |
| R6 | API protégées non ouvertes via `href`/`window.open` | pas de jeton (401) / jeton dans l'historique du navigateur |
| R7 | aucune globale SDK de plateforme directe (wx/dd) | dépend d'objets de plateforme injectés, pas du web pur |

Détail d'implémentation : `stripComments` supprime les commentaires avant le jugement
(pour éviter les faux positifs des chaînes d'exemple dans les commentaires) ; chaque règle
porte un contre-contrôle (double vérification existence + sémantique).

Sortie de succès : `Tout réussi : 7 règles de discipline frontend.`

## 4. Vérification de la page d'accueil (`gen:csharp`)

Hook de génération des modèles C# de bureau `scripts/gen-csharp.mjs` :
- parse toujours le contrat et fait le mapping complet (la chaîne est constamment validée
  contre le vrai contrat) ;
- si `desktop/` n'existe pas, imprime le motif de saut et **sort 0** (ne devient pas rouge
  simplement parce que le dépôt desktop est absent) ;
- s'il existe, écrit `Generated/Models.g.cs` avec comparaison d'octets (utilisable comme
  gate CI « contrat modifié → régénérer »).

## 5. Liste de contrôle d'acceptation manuelle

Parties que les gates ne peuvent pas couvrir, à vérifier à la main :

- **Boucle de connexion** : connexion → vue d'ensemble ; déconnexion → retour à la
  connexion ; rafraîchir la page ne fait pas revenir en arrière.
- **Actualisation silencieuse à l'expiration du jeton** : faire expirer manuellement le
  jeton d'accès, vérifier l'actualisation 401 automatique + rejeu et la récupération sans
  couture.
- **Comportement des gardes** : accès à une route protégée non authentifié → redirection
  vers la connexion avec l'URL d'origine, et retour à la page d'origine après connexion.
- **Utilisateurs/départements** : créer un compte, changer de rôle, désactiver
  (confirmation), erreur de conflit d'unicité mappée sur la saisie, pagination de
  recherche côté serveur.
- **Gouvernance des espaces** : enregistrer quota/seuil d'alerte, geler/dégeler, retrait
  (notifier que les fichiers ne sont pas supprimés), utilisation en lecture seule non
  modifiable à la main.
- **Limitation 429** : échec de connexion trop fréquent affiche « veuillez réessayer plus
  tard ».
- **Appareils réels/navigateurs × résolutions** : navigateurs de bureau en priorité, plus
  les noyaux plus anciens.

> Interaction, style et performances sur appareil réel échappent à la portée des gates ;
> passer par la « liste de contrôle d'acceptation manuelle » avant de fusionner.
