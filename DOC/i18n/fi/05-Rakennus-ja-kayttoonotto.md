# Rakennus ja käyttöönotto

> Täysi prosessi nollasta täydelliseen rakennukseen ja tuotteen upottamiseen palvelimeen. Alkuperäinen kuri: **ensin `pnpm build`
> sitten Go-käännös**, muuten embed ottaa vanhan tuotteen (hiljaa väärä versio).

## 1. Ympäristövaatimukset

| Työkalu | Versio |
|---|---|
| Node.js | ≥ 20 (CI:ssä 22) |
| pnpm | ≥ 9.15.9 (suositus: tarkka versio lockfile-tiedoston mukaan) |
| Go | palvelin (≥ 1.x) — tuotteen embed-käyttöön |

## 2. Riippuvuuksien asennus

```bash
pnpm install --frozen-lockfile
```

`--frozen-lockfile` varmistaa täysin samat asennusversiot kuin `pnpm-lock.yaml` (CI tekee samoin).

## 3. Kehitys

```bash
pnpm dev:admin
```

Käynnistää Vite-kehityspalvelimen (portti **5174**), `/api` edustetaan osoitteeseen `http://127.0.0.1:8080`
(määritetään `vite.config.ts`:n `server.proxy`-kohdassa, suoraan paikalliseen palvelimeen, sama alkuperämuoto kuin tuotannossa).

## 4. Tuotantorakennus

```bash
pnpm build
```

Vastaa komentoa `pnpm --filter @netdisk/admin build` (`vite build`), tuote tulostetaan hakemistoon
**`apps/admin/dist`**.

Keskeinen rakennuskäyttäytyminen (`apps/admin/vite.config.ts`):

- `base: "/admin/"` — resurssiviitteet alkavat alipolusta;
- `outDir: "dist"`, `emptyOutDir: true`;
- `target: "es2021"` — selainten alaraja (yhteensopivuus vanhempien WeCom/DingTalk-ydin-WebViewien kanssa);
- tuotannossa sourcemap poistettu (välttää lähdekoodin/rajapintapolkujen päätymisen julkaisuun);
- resurssitiedostojen nimet sisältävät sisällön hajautuksen (`assets/[name]-[hash].js`) → pitkävälimuistin edellytys.

## 5. Sopimus ja portit (suositellaan ennen rakennusta)

```bash
pnpm gen:api       # sopimuksen muutoksen jälkeen generoi tyypit uudelleen
pnpm check:api     # tuotteen ja sopimuksen johdonmukaisuusportti (kaksisuuntainen diff)
pnpm -r typecheck  # tyypin tarkistus koko säilölle
pnpm check:rules   # käyttöliittymäkuri (7)
```

CI suorittaa ennen rakennusta peräkkäin `check:api → typecheck → check:rules`; mikä tahansa lenkki epäonnistuu → punainen.

## 6. Tuotteen upotus palvelimeen (keskeinen vaihe)

1. Suorita `web-com`-hakemistossa `pnpm build`, saat `apps/admin/dist`;
2. Kopioi `apps/admin/dist` palvelimen `internal/webui/dist/admin/`-kansioon (kansioiden nimi on muuttumaton,
   `go:embed` riippuu siitä);
3. Käännä sitten Go-binääri — tämän jälkeen `/admin` tarjotaan palvelimen `embed`:llä, sama alkuperä API:n kanssa.

> ⚠️ Väärä järjestys (ensin go build, sitten pnpm build) aiheuttaa sen, että palvelin upottaa edelleen vanhan admin-tuotteen;
> ennen tuotantoon julkaisua on tarkistettava, onko `/admin/index.html` uusi versio.

## 7. Käyttöönoton muodon pikaohje

- Yksi portti: käyttöliittymä ja API tarjotaan samalla Go-binääristä, sama alkuperä (Nginx tekee vain TLS:n ja jakelun, ei isännöi
  staattisia resursseja).
- Alipolku: admin on alipolussa `/admin/`, SPA-takaisinpalautuksen toteuttaa Go:n `webui.Handler`,
  erillistä rewriteä ei tarvita.

> Kolme „käyttöönottoon tiukasti sidottua" konfiguraatiota (vite `base` / history / `outDir`) ja valkoisen ruudun seuraukset ks.
> 04-Arkkitehtuuri«Käyttöönoton muoto».

## 8. Tuotteen varmistus

```bash
# vähimmäisvarmistus, että tuote voidaan upottaa embed:llä (sama kuin CI)
test -f apps/admin/dist/index.html || (echo "admin-tuote puuttuu" && exit 1)
```
