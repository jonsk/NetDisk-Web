# Architekturdokument

> Hält die Architekturentscheidungen und Designkonventionen dieses Repos (Web-Frontend)
> fest. Vertrag, Layout, Build-Ziel und Backend sind eng gekoppelt.

## 1. Repository-Form

- **pnpm-Workspace mit einem einzigen Build-Ziel**: `apps/*` + `packages/*`.
- Community Edition behält nur die Admin-Konsole; kein H5-Workspace, keine
  IdP-Integration, keine Audit-Logs.
- Vertrag ist in dieses Repo **gevendort** unter `DOC/api/openapi.yaml` (autoritative
  Quelle im Server-Repo; drei Stellen zu synchronisieren: Server / web / desktop).

## 2. Technologie-Entscheidungen (Schlüsselentscheidungen)

| Aspekt | Wahl | Grund |
|---|---|---|
| Framework | Vue 3 (`<script setup>`) | Komposition, ausgereiftes Ökosystem |
| Build | Vite 5 | Schnell, hashbare Artefakte |
| Zustand | Pinia | Für Vue 3 empfohlen |
| UI | Naive UI | TS-freundlich, bedarfsgerecht |
| Router | Vue Router 4 (History) | Funktioniert mit Go-SPA-Fallback |
| Typen | TS strict + vue-tsc | Disziplin durch Gates gesichert |
| Paketmanager | pnpm | Workspace + strenge Abhängigkeiten |
| Vertrag | openapi-typescript | Single Source generiert Mehr-Ende-Modelle |
| Werkzeugkette | node ≥ 20, pnpm ≥ 9.15.9 | CI entsprechen lokal |

## 3. Bereitstellungsform (einbettbares Frontend)

Das Frontend hat **keinen eigenständigen statischen Server**: Build-Artefakt wird über
`pnpm build` in den Server `internal/webui/dist/` kopiert und von Go `embed` ausgeliefert,
gleiche Herkunft, einzelner Port.

Daraus ergeben sich drei **bereitstellungsgebundene** Einstellungen (Ändern leert die App):

1. **Vite `base: "/admin/"`**: das Frontend hängt am Unterpfad `/admin`; Asset-URLs müssen
   damit beginnen, sonst 404 (leerer Bildschirm + viele 404 in der Konsole).
2. **`createWebHistory("/admin/")`** passt zu `base`; Go implementiert SPA-Fallback bereits.
3. **`outDir: "dist"`**: der Verzeichnisname darf sich nicht ändern, sonst findet
   `go:embed` es nicht; das gen-Skript kopiert `web/apps/admin/dist` nach
   `server/internal/webui/dist/admin`.

**Build-Reihenfolge-Disziplin**: `pnpm build` vor dem Kompilieren von Go ausführen —
sonst bettet der Server ein veraltetes Artefakt ein (still falsche Version).

## 4. Vertrags-Single-Source-Mechanismus

```
DOC/api/openapi.yaml
        │  pnpm gen:api (openapi-typescript)
        ▼
packages/api/src/schema.gen.ts   ← generierte Ausgabe, nicht von Hand ändern
        │  pnpm check:api (lint-contract --check-generated, bidirektionales Diff)
        ▼
        alle Vertragsmodelle / alle Schnittstellentypen
```

- Typ-Einstiegspunkte `Schema` / `Operations` / `Paths` kommen alle aus der Generierung.
- Die drei harten Einschränkungen von `lint:contract` (handgeschriebenes fetch,
  handgeschriebene gleichnamige DTOs, veraltete Generierung) zwingen Anfragen in den
  Client, sodass die "Vertrags-Single-Source" nicht umgangen wird (Umsetzungsdetails in
  06-Testdokument "Vertrags-Gate").
- `gen-csharp` generiert Desktop-C#-Modelle aus demselben Vertrag und hält die
  Mehr-Ende-Verständnisse konsistent.

## 5. Modulverantwortung & Schichten

```
views/ (Seiten: Login/Übersicht/Benutzer & Abteilungen/Speicherverwaltung)
   │  über auth.client()
   ▼
stores/auth.ts (Auth-Zustand: Login/Aktualisieren/Logout/Token) — hält Token & Refresh-Logik
   │
   ▼
packages/api (Client/APIError/Typen) — der einzige Ort, an dem fetch auftreten darf
   │
   ▼
Server-REST-API (vom Vertrag definiert)
```

Prinzipien:

- Seiten bauen Anfragen nie von Hand — immer über `auth.client()`;
- Token-Haltung und Aktualisieren liegen im Store; der Client sendet nur und wiederholt;
- Fehler sind einheitlich `APIError`, nach `code` verzweigt.

## 6. Seitengrenzen (Produktentscheidungen)

- **Web-Konsole = globale Verwaltung**: Speicher anlegen/Mitglieder einladen/Verlassen
  liegen im Desktop-Client; die Konsole bietet sie nicht (vermeidet einen unklaren
  zusätzlichen Einstieg im Berechtigungsmodell).
- **Keine Online-Vorschau** (Bilder/PDF/Office); Dateioperationen im Desktop-Client.
- Verbrauch schreibgeschützt; Warnschwelle ist eine Erinnerungslinie, kein Limit;
  **Einziehen ≠ Löschen** (Dateien werden nicht gelöscht; nur einfrieren + Mitglieder
  entfernen).

## 7. Frontend-Disziplin (check:rules)

Die Admin-Konsole erzwingt über `scripts/check-frontend-rules.mjs` 7 Disziplinregeln
(R1~R7): Pro-Client-Audience, Token-Speicherung, Guards behalten die ursprüngliche URL,
401 stilles Aktualisieren & Wiederholen, Einstiegs-Wiederherstellungsreihenfolge,
geschützte APIs über den Client, keine Plattform-SDK-Globals. Jede Regel hat eine
"brechen → rot"-Gegenprüfung. Vollständige Regeln und Folgen im **06-Testdokument
"Frontend-Disziplin"**.

## 8. CI

`.github/workflows/ci.yml` führt bei push/PR (master/main) die Gate-Kette aus und prüft,
dass das Admin-Artefakt einbettbar ist; `gen-csharp` (Desktop-Modelle) gehört nach der
Teilung zum Desktop-Repo. Vollständige Gate-Reihenfolge im **06-Testdokument "Übersicht der
automatisierten Gates"**.
