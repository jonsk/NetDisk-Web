# Code-Leseanleitung

> Für Entwickler, die erstmals in dieses Repository kommen: Einführung in die
> Verzeichnisstruktur, die Einstiegs-Reihenfolge und die Verantwortung jeder Datei.

## Verzeichnisübersicht

```
web-com/
├─ apps/admin/            # Admin-Konsolen-App (Produktions-Build-Ziel)
│  └─ src/
│     ├─ main.ts          # Einstieg: Store → Router → naive → mount zusammenbauen
│     ├─ App.vue          # Root-Komponente: Config-Provider + Router-Outlet
│     ├─ env.d.ts         # Vite-Client-Umgebungstypen
│     ├─ layouts/
│     │  └─ AdminLayout.vue  # Seitenleiste + Kopfzeile + Router-Outlet + Logout
│     ├─ router/
│     │  └─ index.ts         # Routentabelle + Vor/Nach-Guards
│     ├─ stores/
│     │  └─ auth.ts          # Auth-Zustand: Login/Aktualisieren/Logout/Token-Persistenz
│     └─ views/
│        ├─ LoginView.vue    # Login-Seite
│        ├─ OverviewView.vue # Übersicht (aktuelle Sitzung)
│        ├─ UsersView.vue    # Benutzer- & Abteilungsverwaltung
│        └─ SpacesView.vue   # Speicherverwaltung
├─ packages/api/          # Vertragsgenerierte Basisbibliothek (reines TS, keine Laufzeit-Abh.)
│  └─ src/
│     ├─ schema.gen.ts    # Generierte Datei: alle Vertragstypen (nicht ändern)
│     └─ index.ts         # Client / APIError / Typ-Aliasse
├─ scripts/               # Engineering-Gate-Skripte
│  ├─ lint-contract.mjs       # Vertrags-Lint + bidirektionales Diff
│  ├─ check-frontend-rules.mjs # Frontend-Disziplin (7 Regeln)
│  └─ gen-csharp.mjs          # Desktop-C#-Modellgenerierungs-Hook
├─ DOC/api/openapi.yaml  # Kopie des Vertrags
├─ DOC/                   # Projektdokumentation
├─ pnpm-workspace.yaml    # Workspace-Definition (apps/* + packages/*)
├─ tsconfig.base.json     # Gemeinsame TS-Kompilierungskonfiguration
└─ package.json           # Root-Skripte
```

## Einstiegs-Reihenfolge (`main.ts`)

Die Reihenfolge ist absichtlich; umgekehrt führt sie zu "bei jedem Aktualisieren zur
Login-Seite":

1. `createApp` + `createPinia`, pinia registrieren;
2. `useAuthStore(pinia)` dann **`auth.restore()`** aufrufen (Token aus sessionStorage
   wiederherstellen; nur lokal lesen, keine Netzwerkanfrage);
3. `app.use(router)` (Guards lesen `auth.ready` / `auth.token`);
4. `app.use(naive)`, `app.mount("#app")`.

> **Warum `restore()` vor `use(router)`**: sieht der Routen-Guard bei der ersten Navigation
> "nicht angemeldet" (obwohl das Token existiert), wird der Benutzer bei jedem Aktualisieren
> zur Login-Seite geschickt, mit Flackern.

## Routen & Guards (`router/index.ts`)

- `createWebHistory("/admin/")`: muss zu Vites `base: "/admin/"` passen; Hash-Routing
  degradiert zu `/admin/#/users`, im Widerspruch zum bereits in Go implementierten
  SPA-Fallback.
- `beforeEach`-Guard:
  - `meta.public` (Login-Seite) durchlassen;
  - kein Token → zur Login-Seite, **ursprüngliche URL über `redirect: to.fullPath`
    behalten**;
  - mit Token → durchlassen.
- `afterEach`-Guard: setzt `document.title` aus `meta.title`.
- Catch-all-Route `/:pathMatch(.*)*` leitet zu `/overview` um (vermeidet eine leere
  "System kaputt"-Seite).

## Auth-Store (`stores/auth.ts`)

Drei Kern-Disziplinregeln (jede entspricht einem echten Fehler; siehe Kopfkommentar):

1. `audience: "web"` explizit;
2. Token nur in `sessionStorage`;
3. stilles Aktualisieren und Wiederholen bei Ablauf; Logout nur bei Fehlschlag des
   Aktualisierens.

`client()` gibt einen gemeinsamen Client mit `getToken` + `onUnauthorized` zurück;
`refresh()` wirft bewusst **keine Ausnahme**, sondern gibt `string|null` zurück, damit der
Client entscheidet, ob "dieses 401 zu retten ist".

## REST-Client (`packages/api/src/index.ts`)

- **Stellt nur `request` bereit** (plus rohes `send`): Fehlerbehandlung/Aktualisieren/
  Header haben eine einzige Implementierung, sodass der Client bei wachsenden APIs nicht
  anschwillt.
- Typen **kommen alle aus dem Vertrag** (`schema.gen.ts`); diese Datei schreibt keine
  gleichnamigen Typen von Hand.
- `APIError` ist der einzige geworfene Fehlertyp; nach `code` verzweigen.
- `isBinaryBody`: `Blob`/`FormData`/`ArrayBuffer` unverändert senden, damit Chunk-Uploads
  nicht JSON-serialisiert werden.

## Gate-Skripte (`scripts/`)

- `lint-contract.mjs`: Vertrags-Gate — handgeschriebenes fetch, gleichnamige DTOs,
  veraltete Generierung.
- `check-frontend-rules.mjs`: Frontend-Disziplin (R1~R7), erfasst nur stilles
  Fehlverhalten.
- `gen-csharp.mjs`: bildet den Vertrag auf C#-Modelle ab; wenn `desktop/` nicht existiert,
  nur Kette prüfen und mit 0 beenden.

> Vollständige Regeln, Folgen und Durchlauf-/Fehlausgabe jedes Gates im 06-Testdokument.

## Leseempfehlungen

1. Auth-Schleife von `main.ts` → `router` → `stores/auth.ts` durchgehen;
2. `packages/api/src/index.ts` lesen, um Anfrage/Fehler/Aktualisieren zu verstehen;
3. `views/` durchsehen, wie `auth.client()` APIs aufruft;
4. Für eine API-Änderung zuerst den Vertrag ändern → `pnpm gen:api` → `pnpm check:api`.
