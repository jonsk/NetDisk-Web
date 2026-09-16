# Koodin lukemisen opas

> Ensimmäistä kertaa tähän säilöön tulevalle kehittäjälle: hakemistorakenne, sisäänkäynnin kokoamisjärjestys ja kunkin tiedoston tehtävä.

## Hakemistokierros

```
web-com/
├─ apps/admin/            # hallintakonsolin sovellus (tuotantorakennuksen kohde)
│  └─ src/
│     ├─ main.ts          # sisäänkäynti: store → reitit → naive → mount
│     ├─ App.vue          # juurikomponentti: konfigurointitarjoajat + reittilähtö
│     ├─ env.d.ts         # Vite-asiakkaan ympäristötyypit
│     ├─ layouts/
│     │  └─ AdminLayout.vue  # sivupalkki + yläpalkki + reittilähtö + uloskirjautuminen
│     ├─ router/
│     │  └─ index.ts         # reittitaulukko + ennen/jälkeen-vartijat
│     ├─ stores/
│     │  └─ auth.ts          # todennuksen tila: kirjautuminen/uudistus/uloskirjautuminen/tokenin pysyvyys
│     └─ views/
│        ├─ LoginView.vue    # kirjautumissivu
│        ├─ OverviewView.vue # yleiskatsaus (nykyinen istunto)
│        ├─ UsersView.vue    # käyttäjien ja osastojen hallinta
│        └─ SpacesView.vue   # tilojen hallinta
├─ packages/api/          # sopimuksesta generoitu peruskirjasto (puhdas TS, ei ajonaikaisia riippuvuuksia)
│  └─ src/
│     ├─ schema.gen.ts    # tuote: kaikki sopimuksen tyypit (ei käsin muokattava)
│     └─ index.ts         # Client / APIError / tyyppialiasit
├─ scripts/               # teknisten porttien skriptit
│  ├─ lint-contract.mjs       # sopimuslint + kaksisuuntainen diff
│  ├─ check-frontend-rules.mjs # käyttöliittymäkuri (7)
│  └─ gen-csharp.mjs          # työpöydän C#-mallien generointikoukku
├─ DOC/api/openapi.yaml  # sopimuksen vendored-kopio
├─ DOC/                   # projektin dokumentaatio
├─ pnpm-workspace.yaml    # workspace-määritelmä (apps/* + packages/*)
├─ tsconfig.base.json     # jaettu TS-käännöskonfiguraatio
└─ package.json           # juuriskriptit
```

## Sisäänkäynnin kokoamisjärjestys (`main.ts`)

Järjestys on tarkoituksellinen; kääntämällä se aiheutetaan „päivitys heittää takaisin kirjautumissivulle":

1. `createApp` + `createPinia`, pinian rekisteröinti;
2. `useAuthStore(pinia)` ja kutsutaan **`auth.restore()`** (palautetaan token `sessionStorage`-muistista,
   vain paikallista lukua, ei verkkopyyntöä);
3. `app.use(router)` (vartija lukee `auth.ready` / `auth.token`);
4. `app.use(naive)`, `app.mount("#app")`.

> **Miksi `restore()` on oltava ennen `use(router)`**: jos reittivartija näkee ensimmäisellä navigoinnilla „ei kirjautunut"
> (vaikka token on olemassa), käyttäjä heitetään jokaisella päivityksellä takaisin kirjautumissivulle, vieläpä välkynnällä.

## Reitit ja vartijat (`router/index.ts`)

- `createWebHistory("/admin/")`: on oltava sama kuin Vite:n `base: "/admin/"`;
  hash-reitillä se rappeutuu arvoon `/admin/#/users`, mikä ei vastaa Go-puolen jo toteutettua SPA-takaisinpalautusta.
- Ennakkovartija `beforeEach`:
  - `meta.public` (kirjautumissivu) annetaan suoraan läpi;
  - ei tokenia → siirry kirjautumissivulle ja **säilytä alkuperäinen osoite** `redirect: to.fullPath` avulla;
  - token on → annetaan läpi.
- Jälkivartija `afterEach`: asettaa `document.title`-arvon `meta.title`-mukaan.
- Varareitti `/:pathMatch(.*)*` uudelleenohjaa kohteeseen `/overview` (välttää valkoisen tyhjän „järjestelmä rikki" -vaikutelman).

## Todennus-store (`stores/auth.ts`)

Kolme keskeistä sääntöä (jokainen vastaa todellista vikaa, katso tiedoston alussa oleva kommentti):

1. `audience: "web"` -parametri annetaan nimenomaisesti;
2. token tallennetaan vain `sessionStorage`-muistiin;
3. vanhentuessa hiljainen uudistus ja toisto, uloskirjautuminen vasta uudistuksen epäonnistuessa.

`client()` palauttaa jaetun asiakkaan, jossa on `getToken` + `onUnauthorized`; `refresh()` **ei tarkoituksella heitä poikkeusta**
vaan palauttaa `string|null`, jotta asiakas voi päättää, „voidaanko tämä 401 pelastaa".

## REST-asiakas (`packages/api/src/index.ts`)

- **Avaa vain `request`**: virheenkäsittely/uudistus/otsikot ovat yksi toteutus, vaikka rajapintoja olisi monta.
- Tyypit **kaikki sopimuksesta** (`schema.gen.ts`); tässä tiedostossa ei enää kirjoiteta sopimuksen kanssa samannimisiä tyyppejä.
- `APIError` on ainoa heitetty virhetyyppi, jaetaan `code`-mukaan.
- `isBinaryBody`: Blob/FormData/ArrayBuffer lähetetään sellaisenaan, jotta osiolataus ei JSON-serialisoituisi.

## Porttiskriptit (`scripts/`)

- `lint-contract.mjs`: sopimusportti — käsin kirjoitettu fetch, käsin kirjoitettu samanniminen DTO, vanhentunut tuote (kolme heikkouskohtaa).
- `check-frontend-rules.mjs`: käyttöliittymäkuri 7 sääntöä (R1~R7), kiinnittää vain kohdat „kirjoitetaan väärin, ei virheilmoitusta, vain hiljaa väärin tehtyjä".
- `gen-csharp.mjs`: sopimuksen jäsennys C#-malleiksi; `desktop/` puuttuessa vain ketjun tarkistus, poistuu koodilla 0.

> Kunkin portin täydet säännöt, rikkomisen seuraukset ja läpäisytuloste ks. 06-Testidokumentti.

## Lukusuosituksia

1. Käy läpi todennuksen suljettu ketju: `main.ts` → `router` → `stores/auth.ts`;
2. Lue `packages/api/src/index.ts` ymmärtääksesi pyynnön/virheen/uudistuksen;
3. Katso yksitellen, miten `views/` käyttävät `auth.client()` rajapintojen kutsumiseen;
4. Kun rajapintaa on muutettava: ensin sopimus → `pnpm gen:api` → `pnpm check:api`.
