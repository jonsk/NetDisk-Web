# API-Anleitung

> Der **einzige** Weg, wie das Frontend den Server aufruft, ist über den typisierten
> Client aus `packages/api`. Handgeschriebenes `fetch` ist durch ein statisches Gate
> verboten (siehe "Vertragsdisziplin" unten).

## Inhaltsverzeichnis

1. [Vertrags-Single-Source](#1-vertrags-single-source)
2. [Verwendung des Clients](#2-verwendung-des-clients)
3. [Fehlermodell](#3-fehlermodell)
4. [Authentifizierung & Token](#4-authentifizierung--token)
5. [API-Übersicht](#5-api-ubersicht)
6. [Vertragsdisziplin](#6-vertragsdisziplin)

---

## 1. Vertrags-Single-Source

Der maßgebliche Schnittstellenvertrag liegt im Server-Repo unter `Doc/api/openapi.yaml`;
dieses Repo hält eine Kopie unter `DOC/api/openapi.yaml`. Bei jeder Vertragsänderung:

```bash
pnpm gen:api        # TS-Typen neu generieren nach packages/api/src/schema.gen.ts
pnpm check:api      # Bidirektionales-Diff-Gate: Generierung muss dem Vertrag entsprechen
```

`packages/api/src/schema.gen.ts` ist **Generierungsausgabe — von Hand ändern ist verboten**.
Typ-Einstiegspunkte:

```ts
import type { components, operations, paths, Schema } from "@netdisk/api";
// Schema = components["schemas"] — alle Vertragsmodelle
```

## 2. Verwendung des Clients

`Client` ist der einzige REST-Einstiegspunkt; er stellt nur eine Methode bereit, `request`
(plus das rohe `send`).

```ts
import { Client } from "@netdisk/api";

const c = new Client({
  getToken: () => this.token,           // aktuelles Access-Token injizieren
  onUnauthorized: () => this.refresh(), // stilles-Aktualisieren-Callback bei 401
});

// JSON-Anfrage
const me = await c.request<Record<string, unknown>>("/api/v1/me");

// Mit Query-Parametern
const res = await c.request<{ users: User[]; total: number }>(
  `/api/v1/admin/users?${new URLSearchParams({ limit: "20" }).toString()}`,
);

// Schreibanfrage
await c.request("/api/v1/admin/departments", {
  method: "POST",
  body: { parent_id: "", name: "F&E" },
});
```

Wichtige Verhaltensweisen:

- **Token-Injektion**: automatisch `Authorization: Bearer <token>` hinzugefügt.
- **401 stilles Aktualisieren**: mit `onUnauthorized` zuerst aktualisieren, dann die
  ursprüngliche Anfrage **einmal wiederholen**.
- **Binär-Bodies**: `Blob`/`FormData`/`ArrayBuffer` werden unverändert gesendet, ohne
  `Content-Type` erzwungen zu setzen (damit Chunk-Uploads nicht zu leeren Objekten
  serialisiert werden).
- **Strukturierte Fehler**: jedes Nicht-2xx wirft `APIError` (siehe unten).
- **Gleiche Herkunft**: baseURL standardmäßig leer, gleiche Herkunft wie Backend
  (`credentials: "same-origin"`).

Der Aufrufer hält Token und Aktualisierungslogik (in `stores/auth.ts`); der Client sendet
nur und wiederholt.

## 3. Fehlermodell

Alle Fehler werfen einheitlich `APIError`; der Aufrufer verzweigt nach `code` und **parst
den `message`-Text nie**:

```ts
import { APIError } from "@netdisk/api";

try {
  await c.request(...);
} catch (e) {
  if (e instanceof APIError) {
    // e.status    — HTTP-Statuscode
    // e.code      — Geschäftsfehlercode (z. B. account_conflict)
    // e.details   — strukturierte Zusatzinfo (z. B. Konfliktfeld details.field)
    // e.requestId — Anfrage-ID zur Fehlersuche
    // Bequemlichkeits-Prädikate:
    //   e.isAuthError     — status === 401
    //   e.isSpaceRevoked  — code ∈ {space_revoked, space_gone}
  }
}
```

## 4. Authentifizierung & Token

Der Admin-Login-Ablauf liegt in `apps/admin/src/stores/auth.ts`:

- Login übergibt `audience: "web"` (pro-Client-Audience; ein Fehler zeigt sich als
  "Login gelingt, aber alle APIs geben 403 zurück").
- Access-Token und Refresh-Token werden nur in **sessionStorage** gespeichert (sicher auf
  gemeinsam genutzten Computern).
- Bei Ablauf tauscht `refresh()` das Refresh-Token gegen ein neues Access-Token; bei Erfolg
  auffüllen und Anfrage wiederholen; nur bei Fehlschlag meldet `logout()` den Benutzer ab.
- Der Routen-Guard navigiert vor `auth.ready` nicht (kein Flackern beim Aktualisieren);
  ein nicht angemeldeter Benutzer geht zur Login-Seite und behält die ursprüngliche URL
  über den `redirect`-Query-Parameter.

## 5. API-Übersicht

Phase-1-Endpunkte aus dem Vertrag (vollständige Definitionen in `DOC/api/openapi.yaml`):

| Kategorie | Endpunkte | Beschreibung |
|---|---|---|
| auth | `GET /api/v1/version`、`GET /api/v1/me` | Version, aktueller Benutzer |
| auth | `POST /api/v1/auth/{login,refresh,logout}` | Login/Aktualisieren/Logout |
| files | `GET /api/v1/files`、`files/dirs`、`files/{id}` | Datei/Verzeichnis-Liste und Detail |
| files | `files/{id}/content`、`move`、`copy`、`subtree-stats`、`share-to-space`、`lock` | Inhalt/Verschieben/Kopieren/Statistik/Freigabe/Sperre |
| upload | `POST /api/v1/upload/create`、`{id}`、`{id}/finish` | Chunked-Upload |
| sync | `GET /api/v1/changes`、`changes/head`、`sync/cursors` | Änderungs-Feed/Cursor |
| shares | `shares`、`shares/{id}`、`shares/{token}/meta`、`.../download` | Freigaben |
| admin | `departments`、`departments/{id}` | Abteilungen (admin) |
| admin | `spaces`、`spaces/{id}` usw. | Speicherliste/-detail-Verwaltung |
| admin | `admin/users`、`admin/departments`、`admin/spaces/{id}/freeze` usw. | Benutzer/Abteilungen/Speicherverwaltung |

> Die Admin-Konsole konsumiert derzeit hauptsächlich: `auth/*`, `me`, `admin/users`,
> `admin/departments`, `admin/spaces` (inkl. quota/freeze/revoke).

## 6. Vertragsdisziplin

`pnpm lint:contract` (Kern von `check:api`) erzwingt drei Regeln, damit die
"Vertrags-Single-Source" nicht umgangen wird: **handgeschriebenes fetch wird blockiert**,
**handgeschriebene gleichnamige DTOs werden blockiert** und **veraltete Generierung wird
blockiert**. Vollständige Regeln und Durchlauf-/Fehlausgabe im **06-Testdokument
"Vertrags-Gate"**.
