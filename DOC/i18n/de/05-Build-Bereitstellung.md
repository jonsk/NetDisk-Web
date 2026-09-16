# Build & Bereitstellung

> Der vollständige Ablauf von Grund auf bis zum vollständigen Build und der Einbettung des
> Artefakts in den Server. Leitende Disziplin: **`pnpm build` vor dem Kompilieren von Go
> ausführen** — sonst bettet der Server ein veraltetes Artefakt ein (still falsche Version).

## 1. Umgebungsanforderungen

| Werkzeug | Version |
|---|---|
| Node.js | ≥ 20 (CI verwendet 22) |
| pnpm | ≥ 9.15.9 (exakte Version aus dem Lockfile empfohlen) |
| Go | Server (≥ 1.x) — zum Einbetten des Artefakts |

## 2. Abhängigkeiten installieren

```bash
pnpm install --frozen-lockfile
```

`--frozen-lockfile` garantiert, dass die installierten Versionen genau `pnpm-lock.yaml`
entsprechen (CI macht dasselbe).

## 3. Entwicklung

```bash
pnpm dev:admin
```

Startet den Vite-Dev-Server (Port **5174**) und proxyt `/api` nach
`http://127.0.0.1:8080` (festgelegt durch `server.proxy` in `vite.config.ts`; direkte
Verbindung zum lokalen Server, gleiche Herkunft wie Produktion).

## 4. Produktions-Build

```bash
pnpm build
```

Entspricht `pnpm --filter @netdisk/admin build` (`vite build`); Ausgabe geht nach
**`apps/admin/dist`**.

Wichtige Build-Verhaltensweisen (`apps/admin/vite.config.ts`):

- `base: "/admin/"` — Asset-URLs beginnen mit dem Unterpfad;
- `outDir: "dist"`, `emptyOutDir: true`;
- `target: "es2021"` — Browser-Untergrenze (Kompatibilität mit älteren
  WeCom/DingTalk-eingebetteten WebViews);
- Sourcemaps in Produktion aus (vermeidet, Quellcode/Endpunkt-Pfade auszuliefern);
- Asset-Dateinamen tragen Inhalts-Hashes (`assets/[name]-[hash].js`) → Grundlage für
  langes Caching.

## 5. Vertrag & Gates (vor dem Build empfohlen)

```bash
pnpm gen:api       # Typen nach Vertragsänderung neu generieren
pnpm check:api     # Konsistenz-Gate Generierung vs. Vertrag (bidirektionales Diff)
pnpm -r typecheck  # Typüberprüfung des gesamten Repos
pnpm check:rules   # Frontend-Disziplin (7 Regeln)
```

CI führt vor dem Build `check:api → typecheck → check:rules` aus; jeder Fehlschlag wird rot.

## 6. Artefakt in den Server einbetten (Schlüsselschritte)

1. In `web-com` `pnpm build` ausführen, um `apps/admin/dist` zu erhalten;
2. `apps/admin/dist` in den Server `internal/webui/dist/admin/` kopieren (der
   Verzeichnisname darf sich nicht ändern — `go:embed` hängt davon ab);
3. Dann das Go-Binary kompilieren — danach wird `/admin` vom Server `embed` ausgeliefert,
   gleiche Herkunft wie die API.

> ⚠️ Falsche Reihenfolge (go build vor pnpm build) lässt den Server das alte
> Admin-Artefakt einbetten; vor dem Produktions-Release `/admin/index.html` auf neue
> Version prüfen.

## 7. Bereitstellungsform Kurzreferenz

- Einzelner Port: Frontend und API werden beide gleicher Herkunft aus dem Go-Binary
  ausgeliefert (Nginx macht nur TLS und Routing; hostet keine statischen Assets).
- Unterpfad: admin hängt an `/admin/`; SPA-Fallback durch Gos `webui.Handler`, keine
  zusätzliche Rewrite nötig.

> Die drei "bereitstellungsgebundenen" Einstellungen (Vite `base` / history / `outDir`)
> und ihre Leerbildschirm-Folgen stehen detailliert in 04-Architektur "Bereitstellungsform".

## 8. Artefakt verifizieren

```bash
# Mindestprüfung, dass das Artefakt einbettbar ist (wie CI)
test -f apps/admin/dist/index.html || (echo "Admin-Artefakt fehlt" && exit 1)
```
