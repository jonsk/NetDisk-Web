# Funktionsübersicht

> Dieses Repository ist das **Web-Frontend (Administrationskonsole)** von NetDisk,
> Vue 3 + TypeScript + pnpm workspace.

## Zweck des Repositories

| Punkt | Inhalt |
|---|---|
| Name | **web** (NetDisk-Frontend · Community Edition) |
| Art | Vue 3 + TypeScript + pnpm workspace; einziges Build-Ziel `admin` |
| Stack | Vue 3 / Vite / Pinia / Naive UI / openapi-typescript |
| Konsument | Build-Artefakt wird über `pnpm build` in den Server `internal/webui/dist/` kopiert und von Go `embed` ausgeliefert |
| Vertrag | Dieses Repo enthält eine Kopie von `DOC/api/openapi.yaml` (Autoritative Quelle: `Doc/api/openapi.yaml`) |

**Unterverzeichnisse**: `apps/admin`, `packages/api`, `scripts`, `DOC`.

---

## A. Administrationskonsole (`apps/admin`) — nur IT-Administratoren

| Seite / Modul | Datei | Funktion |
|---|---|---|
| Login | `views/LoginView.vue` + `stores/auth.ts` | Admin-Login, Token-Speicherung / stilles Aktualisieren |
| Übersicht | `views/OverviewView.vue` | Informationen zur aktuellen Sitzung (Benutzer/Rolle/Audience/request_id) |
| Benutzer & Abteilungen | `views/UsersView.vue` | CRUD für Benutzer/Abteilungen, Deaktivieren/Aktivieren, Rollenwechsel, Bestätigungsdialoge |
| Speicherverwaltung | `views/SpacesView.vue` | Speicherliste, Kontingent/Warnschwelle, Einfrieren, Einziehen |
| Rahmen | `layouts/AdminLayout.vue` + `router/index.ts` | Layout, Routen-Guards (Login/Auth/ursprüngliche URL) |

> **Fähigkeitsgrenze (festgelegt)**: keine Online-Vorschau (Bilder / PDF / Office);
> Dateisuchen und -übertragung liegen im Desktop-Client. Die Web-Konsole macht nur
> **globale Verwaltung**; Einstiege für Zusammenarbeit wie Speicher anlegen / Mitglieder
> einladen liegen im Desktop-Client.

### Detail je Seite

- **Login**: übergibt explizit `audience: "web"` (pro-Client-Audience), Token in
  `sessionStorage`, einheitliche Login-Fehlermeldung (unterscheidet nicht "Benutzer nicht
  gefunden / falsches Passwort"), 429 separat angezeigt.
- **Übersicht**: zeigt nur den aktuellen Benutzer; bewusst keine Fake-Daten-Diagramme.
- **Benutzer & Abteilungen**: serverseitige Suche/Seitengrenzen (keine Frontend-Filterung),
  Deaktivierungsbestätigung (hat externe Auswirkung), Eindeutigkeitskonflikte auf
  konkrete Eingabefelder, Abteilungsbaum hinzufügen/löschen.
- **Speicherverwaltung**: Verbrauch schreibgeschützt (nur durch Upload/Lösch-Transaktionen
  geändert); Warnschwelle ist eine "Erinnerungslinie", kein Limit (das 95-%-Limit ist eine
  serverseitige harte Regel); **Einziehen ≠ Löschen** (Einfrieren + Mitglieder entfernen,
  Dateien werden NICHT gelöscht).

---

## B. Gemeinsame Bibliotheken (`packages/`)

- **`packages/api`**:
  - `src/schema.gen.ts` — von OpenAPI generierte Typen (Vertrags-Single-Source,
    **nicht von Hand ändern**);
  - `src/index.ts` — typisierter REST-Client-Wrapper (fetch/DTO/Token-Injektion/stilles
    Aktualisieren), der einzige Ort, an dem `fetch(` auftreten darf.

---

## C. Engineering-Gates (`scripts/`)

- **`lint-contract.mjs`** (`check:api` / `lint:contract`): Vertrags-Gate — begrenzt
  handgeschriebenes fetch, handgeschriebene gleichnamige DTOs und veraltete
  Generierungsausgabe (Details in 06-Testdokument "Vertrags-Gate").
- **`check-frontend-rules.mjs`** (`check:rules`): 7 Frontend-Disziplinregeln (R1~R7),
  jede mit Gegenprüfung (Details in 06-Testdokument "Frontend-Disziplin").
- **`gen-csharp.mjs`**: Desktop-C#-Modellgenerierungs-Hook (wenn `desktop/` nicht
  existiert, nur Kette prüfen und mit 0 beenden).

---

## D. Build & Skripte (`package.json`)

`build` / `build:admin` / `dev:admin` / `typecheck` / `lint` / `gen:api` /
`gen:csharp` / `check:api` / `lint:contract` / `check:rules`
