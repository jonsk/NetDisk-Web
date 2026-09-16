# API-opas

> Ainoa tapa kutsua palvelinta etupäästä on `packages/api`-paketin tyypitetty asiakas.
> Käsin kirjoitettu fetch on estetty staattisella portilla (katso alla „Sopimuskuri").

## Sisällys

1. [Sopimuksen yksilähde](#1-sopimuksen-yksilähde)
2. [Asiakkaan käyttö](#2-asiakkaan-käyttö)
3. [Virhemalli](#3-virhemalli)
4. [Todennus ja tokenit](#4-todennus-ja-tokenit)
5. [Rajapintojen yleiskatsaus](#5-rajapintojen-yleiskatsaus)
6. [Sopimuskuri](#6-sopimuskuri)

---

## 1. Sopimuksen yksilähde

Rajapintasopimuksen ainoa totuus on palvelinsäilön `Doc/api/openapi.yaml`; tämä säilö pitää vendored-kopiota
sijainnissa `DOC/api/openapi.yaml`. Kun sopimusta muutetaan:

```bash
pnpm gen:api        # generoi TS-tyypit uudelleen kohteeseen packages/api/src/schema.gen.ts
pnpm check:api      # kaksisuuntainen diff-portti: tuotteen on vastattava sopimusta
```

`packages/api/src/schema.gen.ts` on **tuote, jonka muuttaminen käsin on kielletty**. Tyyppien sisäänkäynti:

```ts
import type { components, operations, paths, Schema } from "@netdisk/api";
// Schema = components["schemas"] —— kaikki sopimuksen mallit
```

## 2. Asiakkaan käyttö

`Client` on ainoa REST-kutsun sisäänkäynti, se avaa vain `request`-metodin (sekä raa'an `send`).

```ts
import { Client } from "@netdisk/api";

const c = new Client({
  getToken: () => this.token,          // injektoi nykyisen access-tokenin
  onUnauthorized: () => this.refresh(), // 401-tilanteen hiljaisen uudistuksen soittaja
});

// JSON-pyyntö
const me = await c.request<Record<string, unknown>>("/api/v1/me");

// kyselyparametreilla
const res = await c.request<{ users: User[]; total: number }>(
  `/api/v1/admin/users?${new URLSearchParams({ limit: "20" }).toString()}`,
);

// kirjoituspyyntö
await c.request("/api/v1/admin/departments", {
  method: "POST",
  body: { parent_id: "", name: "Kehitys" },
});
```

Keskeinen käyttäytyminen:

- **Tokenin injektointi**: lisää automaattisesti `Authorization: Bearer <token>`.
- **Hiljainen uudistus 401:ssä**: kun `onUnauthorized` on olemassa, uudistaa ensin ja **toistaa** alkuperäisen pyynnön **kerran**.
- **Binaaritieto**: `Blob`/`FormData`/`ArrayBuffer` lähetetään sellaisenaan eikä `Content-Type`-kenttää aseteta oletuksena
  (jotta osiolataus ei serialisoituisi tyhjäksi olioksi).
- **Rakenteellinen virhe**: mikä tahansa ei-2xx heittää `APIError` (katso alla).
- **Sama alkuperä**: oletusarvoisesti baseURL on tyhjä, sama alkuperä taustapalvelimen kanssa (`credentials: "same-origin"`).

Tokenin omistus ja uudistuslogiikka ovat soittajapuolella (`stores/auth.ts`); asiakas vastaa vain lähettämisestä ja toistosta.

## 3. Virhemalli

Kaikki virheet heitetään yhtenäisesti `APIError`-tyyppinä, soittaja jakaa `code`-kentän mukaan, **ilman message-tekstin tulkintaa**:

```ts
import { APIError } from "@netdisk/api";

try {
  await c.request(...);
} catch (e) {
  if (e instanceof APIError) {
    // e.status    —— HTTP-tilakoodi
    // e.code      —— liiketoiminnan virhekoodi (esim. account_conflict)
    // e.details   —— rakenteellinen lisätieto (esim. konfliktikenttä details.field)
    // e.requestId —— vianetsinnän pyyntötunnus
    // kätevät predikaatit:
    //   e.isAuthError     —— status === 401
    //   e.isSpaceRevoked  —— code ∈ {space_revoked, space_gone}
  }
}
```

## 4. Todennus ja tokenit

Hallintakonsolin kirjautumisprosessi on `apps/admin/src/stores/auth.ts`:

- Kirjautuessa lähetetään `audience: "web"` (audienssi haaroittain; virhe näkyy „kirjautuminen onnistui, mutta kaikki rajapinnat antavat 403").
- access-token ja refresh-token tallennetaan vain **sessionStorage**-muistiin (turvallisuus jaetuilla tietokoneilla).
- Vanhentuessa `refresh()` vaihtaa refresh-tokenin uudeksi access-tokeniksi, onnistumisen jälkeen täyttää ja toistaa pyynnön;
  vasta uudistuksen epäonnistuessa `logout()` vie takaisin kirjautumissivulle.
- Reittivartija ei siirry ennen `auth.ready` -tilaa välttääkseen sivun päivityksen välkkymisen; ei-kirjautuneena siirtyy kirjautumissivulle ja
  käyttää `redirect`-kyselyparametria **alkuperäisen osoitteen säilyttämiseksi**.

## 5. Rajapintojen yleiskatsaus

Sopimuksen kattamat ensimmäisen vaiheen rajapinnat (täysi määritelmä tiedostossa `DOC/api/openapi.yaml`):

| Luokka | Päätepiste | Kuvaus |
|---|---|---|
| auth | `GET /api/v1/version`, `GET /api/v1/me` | Versio, nykyinen kirjautuja |
| auth | `POST /api/v1/auth/{login,refresh,logout}` | Kirjautuminen/uudistus/uloskirjautuminen |
| files | `GET /api/v1/files`, `files/dirs`, `files/{id}` | Tiedosto-/hakemistoluettelo ja tiedot |
| files | `files/{id}/content`, `move`, `copy`, `subtree-stats`, `share-to-space`, `lock` | Sisältö/siirto/kopiointi/tilastot/jaot/lukko |
| upload | `POST /api/v1/upload/create`, `{id}`, `{id}/finish` | Osiolataus |
| sync | `GET /api/v1/changes`, `changes/head`, `sync/cursors` | Muutosvirta/kohdistimet |
| shares | `shares`, `shares/{id}`, `shares/{token}/meta`, `.../download` | Jaot |
| admin | `departments`, `departments/{id}` | Osastot (admin) |
| admin | `spaces`, `spaces/{id}` jne. | Tilaluettelo/tietojen hallinta |
| admin | `admin/users`, `admin/departments`, `admin/spaces/{id}/freeze` jne. | Käyttäjä-/osasto-/tilahallinta |

> Hallintakonsoli kuluttaa tällä hetkellä pääasiassa: `auth/*`, `me`, `admin/users`, `admin/departments`,
> `admin/spaces` (mukaan lukien quota/freeze/revoke).

## 6. Sopimuskuri

`pnpm lint:contract` (`check:api`-ytimen) pakottaa kolme asiaa, jotta „sopimuksen yksilähde" ei ohiteta:
**käsin kirjoitettu fetch estetään**, **käsin kirjoitettu samanniminen DTO estetään**, **vanhentunut tuote estetään**. Täydet säännöt ja
läpäisy/ovirrallinen tuloste ks. **06-Testidokumentti«Sopimusportit»**.
