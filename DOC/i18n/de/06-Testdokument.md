# Testdokument

> Dieses Repository enthält **keinen** Browser-Test-Runner. Stattdessen werden
> Disziplinen, die aus Text bestimmbar sind, in abhängigkeitsfreie statische Gates
> umgewandelt, die direkt in CI laufen; jede Regel kann "brechen → rot". Gates **können**
> die manuelle Abnahme (Interaktion, Styling, echte Geräte) nicht ersetzen; beides
> ergänzt sich.

## 1. Übersicht der automatisierten Gates

| Gate | Befehl | Was es tut |
|---|---|---|
| Vertrags-Konsistenz | `pnpm check:api` | Bidirektionales Diff der Generierung vs. `openapi.yaml` + handgeschriebenes fetch/DTO-Lint |
| Vertrags-Lint | `pnpm lint:contract` | Der Lint-Teil des Obigen |
| Typüberprüfung | `pnpm -r typecheck` | vue-tsc / tsc Strict-Mode-Typüberprüfung des gesamten Repos |
| Frontend-Disziplin | `pnpm check:rules` | 7 statische Disziplinregeln |
| Build | `pnpm build` | Artefakten kompilieren + `dist/index.html`-Existenz prüfen |

**CI-Reihenfolge** (`.github/workflows/ci.yml`):
`install(frozen) → check:api → typecheck → check:rules → build →` Artefaktprüfung.

## 2. Vertrags-Gate (`check:api` / `lint:contract`)

Skript `scripts/lint-contract.mjs` schützt vor drei Arten, wie die "Vertrags-Single-Source"
still gebrochen wird:

1. **Handgeschriebenes fetch**: ein `fetch(` außerhalb von `packages/api` schlägt fehl —
   Anfragen müssen in den Client, damit Typen/Fehler/Aktualisieren eine Implementierung
   haben.
2. **Handgeschriebenes gleichnamiges DTO**: `packages/api` darf kein `interface/type` mit
   gleichem Namen wie ein generiertes Modell haben (stattdessen
   `export type X = Schema["X"]` schreiben, das dem Vertrag folgt).
3. **Veraltete Generierung** (`--check-generated`): neu generieren und mit der
   eingecheckten Ausgabe byteweise vergleichen; eine Abweichung bedeutet Vertrag geändert
   ohne Regenerierung oder die generierte Datei wurde von Hand geändert.

Durchlauf-Ausgabe: `Vertrags-Gate bestanden: fetch konvergiert, kein handgeschriebenes DTO,
Generierung entspricht dem Vertrag.`

## 3. Frontend-Disziplin (`check:rules`)

Skript `scripts/check-frontend-rules.mjs`, 7 Disziplinregeln, jede erfasst "meldet keinen
Fehler, tut aber still das Falsche":

| Regel | Prüfung | Folge bei Bruch |
|---|---|---|
| R1 | Admin-Login übergibt `audience="web"` | Login gelingt, aber alle APIs geben 403 |
| R2 | Token nur in sessionStorage (kein localStorage) | Verwaltungs-Zugangsdaten bleiben auf gemeinsam genutzten Computern |
| R3 | Guard leitet zur Login-Seite um und behält ursprüngliche URL (redirect) | Benutzer landet nach Login auf der Startseite, verliert die ursprüngliche Seite |
| R4 | 401 stilles Aktualisieren und **einmal wiederholen** (doFetch zweimal) | Aktualisieren ohne Wiederholen = Anfrage schlägt weiterhin fehl |
| R5 | Einstieg `auth.restore()` vor dem Mounten des Routers | bei jedem Aktualisieren zur Login-Seite |
| R6 | Geschützte APIs nicht über `href`/`window.open` öffnen | kein Token (401) / Token im Browserverlauf |
| R7 | keine direkten Plattform-SDK-Globals (wx/dd) | hängt von injizierten Plattform-Objekten ab, nicht reines Web |

Umsetzungsdetail: `stripComments` entfernt Kommentare vor der Prüfung (vermeidet
Fehlalarme durch Beispiel-Strings in Kommentaren); jede Regel trägt eine Gegenprüfung
(Existenz + semantische Doppelprüfung).

Durchlauf-Ausgabe: `Alle bestanden: 7 Frontend-Disziplinregeln.`

## 4. Homepage-Verifizierung (`gen:csharp`)

Desktop-C#-Modellgenerierungs-Hook `scripts/gen-csharp.mjs`:
- parst immer den Vertrag und macht das vollständige Mapping (die Kette wird ständig gegen
  den echten Vertrag validiert);
- wenn `desktop/` nicht existiert, Skip-Grund drucken und **mit 0 beenden** (wird nicht
  rot, nur weil das Desktop-Repo fehlt);
- wenn es existiert, `Generated/Models.g.cs` mit Byte-Vergleich schreiben (nutzbar als
  CI-"Vertrag geändert → neu generieren"-Gate).

## 5. Checkliste für manuelle Abnahme

Teile, die Gates nicht abdecken, von Hand zu prüfen:

- **Login-Schleife**: Login → Übersicht; Logout → zurück zur Login-Seite; Seitenaktualisieren
  wirft nicht zurück.
- **Token-Ablauf stilles Aktualisieren**: Access-Token manuell auslaufen lassen,
  automatisches 401-Aktualisieren + Wiederholen und nahtlose Erholung prüfen.
- **Guard-Verhalten**: Zugriff auf geschützte Route ohne Anmeldung → Umleitung zur
  Login-Seite mit ursprünglicher URL und nach Login zurück zur ursprünglichen Seite.
- **Benutzer/Abteilungen**: Konto anlegen, Rolle wechseln, Deaktivieren (Bestätigung),
  Eindeutigkeitskonflikt aufs Eingabefeld, serverseitige Suchseitengrenzen.
- **Speicherverwaltung**: Kontingent/Warnschwelle speichern, Einfrieren/Auftauen, Einziehen
  (hinweisen: Dateien werden nicht gelöscht), Verbrauch schreibgeschützt nicht
  handbearbeitbar.
- **429-Ratenbegrenzung**: zu häufiger Login-Fehlschlag zeigt "bitte später erneut
  versuchen".
- **Echte Geräte/Browser × Auflösungen**: hauptsächlich Desktop-Browser, plus ältere
  Kerne.

> Interaktion, Styling und Echtgeräte-Verhalten liegen außerhalb der Reichweite der Gates;
> vor dem Zusammenführen die "Checkliste für manuelle Abnahme" durchgehen.
