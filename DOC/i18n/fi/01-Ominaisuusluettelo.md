# Toimintoluettelo

> Tämä säilö = NetDisk -verkkolevyn **Web-käyttöliittymä (hallintakonsoli)**, Vue 3 + TypeScript + pnpm workspace.

## Säilön asemointi

| Kohta | Sisältö |
|---|---|
| Nimi | **web** (verkkolevyn käyttöliittymä · yhteisöversio) |
| Luonne | Vue 3 + TypeScript + pnpm workspace; yksittäinen rakennustavoite `admin` |
| Teknologiapino | Vue 3 / Vite / Pinia / Naive UI / openapi-typescript |
| Kuluttaja | Tuote kopioidaan `pnpm build`:lla palvelimen `internal/webui/dist/`-kansioon, tarjotaan Go `embed`:llä |
| Sopimus | Tämä säilö pitää vendored-kopiota `DOC/api/openapi.yaml` (ensisijainen lähde `Doc/api/openapi.yaml`) |

**Alikansiot**: `apps/admin`, `packages/api`, `scripts`, `DOC`.

---

## A. Hallintakonsoli (`apps/admin`) — vain IT-järjestelmänvalvojalle

| Sivu/moduli | Tiedosto | Toiminto |
|---|---|---|
| Kirjautuminen | `views/LoginView.vue` + `stores/auth.ts` | Järjestelmänvalvojan kirjautuminen, tokenin tallennus/hiljainen uudistus |
| Yleiskatsaus | `views/OverviewView.vue` | Nykyisen istunnon tiedot (käyttäjä/rooli/audienssi/request_id) |
| Käyttäjät ja osastot | `views/UsersView.vue` | Käyttäjien ja osastojen CRUD, käytöstä poisto/käyttöönotto, roolimuutokset, toinen vahvistus |
| Tilojen hallinta | `views/SpacesView.vue` | Tilaluettelo, kiintiö/varmistuskynnykset, jäädytys, peruutus |
| Runko | `layouts/AdminLayout.vue` + `router/index.ts` | Asettelu, reittivartijat (kirjautuminen/valtuutus/alkuperäinen osoite) |

> **Kyvykkyyden raja (lopullinen)**: ei toteuteta mitään online-esitystä (kuvat / PDF / Office); tiedostojen selailu ja siirto
> tapahtuvat työpöytäasiakkaassa. Web-konsoli tekee vain **globaalia hallintaa**; uusien tilojen luonti/jäsenten kutsuminen tehdään
> työpöytäasiakkaassa.

### Sivukohtaiset yksityiskohdat

- **Kirjautuminen**: `audience: "web"` -parametri annetaan nimenomaisesti (audienssi haaroittain), token tallennetaan `sessionStorage`-muistiin,
  kirjautumisvirheessä yhtenäinen teksti (ei erotella „käyttäjää ei ole / väärä salasana"), 429-tilanteessa erillinen vihje.
- **Yleiskatsaus**: näyttää vain nykyisen kirjautujan tiedot, tarkoituksella ei tekaistuja datakuvaajia.
- **Käyttäjät ja osastot**: haku/sivutus palvelimella (ei etupään suodatusta), käytöstä poiston toinen vahvistus (ulkoinen vaikutus),
  yksilöllisyyskonfliktivirhe kohdistuu tiettyyn syöttökenttään, osastopuun lisäys/poisto.
- **Tilojen hallinta**: käyttö vain luku -tilassa (muuttuu vain lataus/poisto-tapahtumissa), varmistuskynnys on „muistutusraja" eikä yläraja
  (95 %:n yläraja on palvelimen kova politiikka), **peruutus ≠ poisto** (jäädytys + jäsenten tyhjennys, tiedostoja ei poisteta).

---

## B. Yhteinen kirjasto (`packages/`)

- **`packages/api`**:
  - `src/schema.gen.ts` — OpenAPI-tyyppien automaattinen generointi (sopimuksen yksilähde, **ei käsin muokattava**);
  - `src/index.ts` — tyypitetty REST-asiakas-kääre (fetch/DTO/tokenin injektointi/hiljainen uudistus,
    ainoa paikka, jossa `fetch(` on sallittu).

---

## C. Tekniset portit (`scripts/`)

- **`lint-contract.mjs`** (`check:api` / `lint:contract`): sopimusportti — rajoittaa kolmea heikkouskohtaa:
  käsin kirjoitettu fetch, käsin kirjoitettu samanniminen DTO, vanhentunut tuote (yksityiskohdat kohdassa 06-Testidokumentti«Sopimusportit»).
- **`check-frontend-rules.mjs`** (`check:rules`): käyttöliittymäkuri 7 sääntöä (R1~R7),
  jokaiselle on käänteinen vahvistus (yksityiskohdat kohdassa 06-Testidokumentti«Käyttöliittymäkuri»).
- **`gen-csharp.mjs`**: työpöydän C#-mallien generointikoukku (`desktop/` puuttuessa vain ketjun tarkistus, poistuu koodilla 0).

---

## D. Rakennus ja skriptit (`package.json`)

`build` / `build:admin` / `dev:admin` / `typecheck` / `lint` / `gen:api` /
`gen:csharp` / `check:api` / `lint:contract` / `check:rules`
