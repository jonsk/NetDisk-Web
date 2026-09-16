# Arkkitehtuuridokumentti

> Tallentaa tämän säilön (web-käyttöliittymä) arkkitehtuuripäätökset ja suunnittelu- yleissopimukset. Sopimus, asettelu, rakennustavoite ovat tiukasti sidoksissa taustapalvelimeen.

## 1. Säilön muoto

- **pnpm-workspace, jolla on yksittäinen rakennustavoite**: `apps/*` + `packages/*`.
- Yhteisöversio sisältää vain hallintakonsolin: ei H5-työasemaa, ei IDP-integraatiota, ei auditointilokeja.
- Sopimus **vendored** tähän säilöön `DOC/api/openapi.yaml` (ensisijainen lähde palvelinsäilössä, kolme synkronoitavaa paikkaa:
  palvelin / web / työpöytä).

## 2. Teknologiavalinnat (keskeiset päätökset)

| Huomion kohde | Valinta | Syy |
|---|---|---|
| Kehys | Vue 3 (`<script setup>`) | Kompositionaalinen, kypsä ekosysteemi |
| Rakennus | Vite 5 | Nopea, tuote voidaan välimuistittaa hajautuksen mukaan |
| Tila | Pinia | Virallinen suositus Vue 3:lle |
| UI | Naive UI | TS-ystävällinen, tarvittaessa |
| Reititys | Vue Router 4 (History) | Yhdessä Go:n SPA-takaisinpalautuksen kanssa |
| Tyypit | TS strict + vue-tsc | Tyyppikuri lukittu porteilla |
| Paketinhallinta | pnpm | workspace + tiukat riippuvuudet |
| Sopimus | openapi-typescript | Yksilähde monikanavaisten mallien generointiin |
| Työkalut | node ≥ 20, pnpm ≥ 9.15.9 | CI ja paikallisesti samat |

## 3. Käyttöönoton muoto (upotettava käyttöliittymä)

Käyttöliittymällä **ei ole erillistä staattista palvelinta**: tuote kopioidaan `pnpm build`:lla palvelimen
`internal/webui/dist/`-kansioon, tarjotaan Go `embed`:llä, sama alkuperä ja yksi portti API:n kanssa.

Tästä seuraa kolme **käyttöönottoon tiukasti sidottua** konfiguraatiota (muuta → valkoinen ruutu):

1. **vite `base: "/admin/"`**: käyttöliittymä on alipolussa `/admin`, resurssiviitteiden on alettava tästä,
   muuten 404 (valkoinen ruutu + joukko 404:tä konsolissa).
2. **`createWebHistory("/admin/")`** vastaa `base`-arvoa; Go-puolella on jo SPA-takaisinpalautus.
3. **`outDir: "dist"`**: kansioiden nimeä ei saa muuttaa, muuten `go:embed` ei löydä; gen-skripti kopioi
   `web/apps/admin/dist` kohteeseen `server/internal/webui/dist/admin`.

**Rakennusjärjestyksen kuri**: ensin `pnpm build`, sitten Go-käännös — muuten embed ottaa vanhan tuotteen (hiljaa väärä versio).

## 4. Sopimuksen yksilähde -mekanismi

```
DOC/api/openapi.yaml
        │  pnpm gen:api (openapi-typescript)
        ▼
packages/api/src/schema.gen.ts   ← tuote, ei käsin muokattava
        │  pnpm check:api (lint-contract --check-generated, kaksisuuntainen diff)
        ▼
käytetään kaikki sopimuksen mallit / kaikki rajapintatyypit
```

- Tyyppien sisäänkäynti `Schema` / `Operations` / `Paths` tulee kaikki tuotteesta.
- `lint:contract` -kolme kovaa rajoitusta (käsin kirjoitettu fetch, käsin kirjoitettu samanniminen DTO, vanhentunut tuote) pakottavat pyynnöt
  keskittymään asiakkaaseen, varmistaen, ettei „sopimuksen yksilähde" ohitu (toteutusyksityiskohdat ks. 06-Testidokumentti«Sopimusportit»).
- `gen-csharp` generoi työpöydän C#-mallit samasta sopimuksesta, varmistaen yhdenmukaisen ymmärryksen kaikilla kanavilla.

## 5. Moduulien tehtävät ja kerrokset

```
views/ (sivut: kirjautuminen/yleiskatsaus/käyttäjät-osastot/tilojen hallinta)
   │  kutsutaan auth.client():n kautta
   ▼
stores/auth.ts (todennuksen tila: kirjautuminen/uudistus/uloskirjautuminen/token) ── omistaa tokenin ja uudistuslogiikan
   │
   ▼
packages/api (Client/APIError/tyypit) ── ainoa paikka, jossa fetch on sallittu
   │
   ▼
palvelimen REST API (sopimuksen määrittelemä)
```

Periaatteet:

- Sivut eivät kokoa pyyntöjä itse — aina `auth.client()`:n kautta;
- tokenin omistus ja uudistus ovat store:ssa; asiakas vastaa vain lähettämisestä ja toistosta;
- virheet yhtenäisesti `APIError`, jaetaan `code`-mukaan.

## 6. Sivun rajat (tuotepäätös)

- **Web-konsoli = globaali hallinta**: tilojen luonti/jäsenten kutsuminen/poistuminen ovat työpöydässä, konsoli ei tarjoa niitä
  (välttää yhden selittämättömän sisäänkäynnin lisäämisen käyttöoikeusmalliin).
- **Ei mitään online-esitystä** (kuvat/PDF/Office), tiedostotoiminnot työpöytäasiakkaassa.
- Käyttö vain luku -tilassa; varmistuskynnys on muistutusraja eikä yläraja; **peruutus ≠ poisto** (tiedostoja ei poisteta, vain jäädytys+jäsenten tyhjennys).

## 7. Käyttöliittymäkuri (check:rules)

Hallintakonsoli pakottaa `scripts/check-frontend-rules.mjs`:n kautta 7 sääntöä (R1~R7):
audienssi haaroittain, tokenin tallennus, vartija säilyttää alkuperäisen osoitteen, hiljainen uudistus ja toisto 401:ssä,
sisäänkäynnin palautusjärjestys, suojatun API:n kutsu asiakkaan kautta, alustan globaalin SDK:n kielto. Jokaisella on „rikkoi → punainen" -käänteisvahvistus,
täydet säännöt ja rikkomisen seuraukset ks. **06-Testidokumentti«Käyttöliittymäkuri»**.

## 8. CI

`.github/workflows/ci.yml` suorittaa push/PR-toiminnassa (master/main) porttiketjun ja varmistaa, että admin-tuote
voidaan upottaa embed:llä; gen-csharp (työpöydän mallit) kuuluu jo työpöytäsäilöön jaon jälkeen. Täysi porttijärjestys ks.
**06-Testidokumentti«Automaattisten porttien yleiskatsaus»**.
