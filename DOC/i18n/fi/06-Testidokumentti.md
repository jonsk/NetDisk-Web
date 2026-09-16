# Testidokumentti

> Tähän säilöön **ei ole otettu käyttöön selaintestin suoritinta**. Sen sijaan ne säännöt, jotka voidaan päätellä tekstistä, tehdään
> riippumattomiksi staattisiksi porteiksi, jotka voidaan ajaa suoraan CI:ssä ja jotka jokainen „rikkoi → punainen". Portit **eivät** voi
> korvata manuaalista hyväksyntää (vuorovaikutus, tyylit, oikeat laitteet) — molemmat tarvitaan, ne täydentävät toisiaan.

## I. Automaattisten porttien yleiskatsaus

| Portti | Komento | Mitä tekee |
|---|---|---|
| Sopimuksen johdonmukaisuus | `pnpm check:api` | Tuotteen ja `openapi.yaml`:n kaksisuuntainen diff + käsin kirjoitetun fetch/DTO-lint |
| Sopimuslint | `pnpm lint:contract` | Sama lint-osa |
| Tyypin tarkistus | `pnpm -r typecheck` | vue-tsc/tsc tiukka tila koko säilön tyypin tarkistus |
| Käyttöliittymäkuri | `pnpm check:rules` | 7 säännön staattinen tarkistus |
| Rakennus | `pnpm build` | Tuotteen kääntö + `dist/index.html`-tiedoston olemassaolon varmistus |

**CI-järjestys** (`.github/workflows/ci.yml`):
`install(frozen) → check:api → typecheck → check:rules → build →`
tuotteen varmistus.

## II. Sopimusportti (`check:api` / `lint:contract`)

Skripti `scripts/lint-contract.mjs`, estää kolmea „sopimuksen yksilähteen salaa rikkovaa" asiaa:

1. **Käsin kirjoitettu fetch**: `fetch(`:n ilmestyminen `packages/api`-kansion ulkopuolelle on virhe — pyyntöjen on keskiyttävä
   asiakkaaseen, jotta tyyppi/virhe/uudistus ovat yksi toteutus.
2. **Käsin kirjoitettu samanniminen DTO**: `packages/api`:ssa ei saa olla `interface/type`-tyyppiä, jolla on sama nimi kuin generoidulla mallilla
   (tulee kirjoittaa `export type X = Schema["X"]`, seuraa sopimuksen muutoksia).
3. **Vanhentunut tuote** (`--check-generated`): uudelleengeneroinnin jälkeen tavuttainen vertailu lähetettyyn — ero tarkoittaa
   sopimuksen muuttamista ilman uudelleengenerointia tai tuotteen käsin muokkaamista.

Läpäisytuloste: `Sopimusportti läpäisty: fetch keskittynyt, ei käsin kirjoitettuja DTO:ita, tuote vastaa sopimusta`.

## III. Käyttöliittymäkuri (`check:rules`)

Skripti `scripts/check-frontend-rules.mjs`, 7 sääntöä, jokainen kiinnittää kohdat „kirjoitetaan väärin, ei virheilmoitusta, vaan hiljaa
tehdään väärin":

| Sääntö | Tarkistuskohta | Rikkomisen seuraus |
|---|---|---|
| R1 | Admin-kirjautuminen mukana `audience="web"` | Kirjautuminen onnistuu, mutta kaikki rajapinnat antavat 403 |
| R2 | Token vain sessionStorage-muistissa (localStorage kielletty) | Jaetun koneen pitkäaikainen hallintatunnisteen tallennus |
| R3 | Vartija ei-kirjautuneena siirtyy kirjautumissivulle ja säilyttää alkuperäisen osoitteen (redirect) | Kirjautumisen jälkeen palautetaan etusivulle, alkuperäinen sivu menetetään |
| R4 | 401:ssä hiljainen uudistus ja **toisto kerran** (doFetch kahdesti) | Pelkkä uudistus ilman toistoa = silti epäonnistuu |
| R5 | Sisäänkäynnissä ensin `auth.restore()` sitten reittien kiinnitys | Jokainen päivitys heittää kirjautumissivulle |
| R6 | Suojattua API:ta ei saa avata suoraan `href/window.open` | Ei tokenia → 401 / token päätyy selaimen historiaan |
| R7 | Konsolissa ei saa käyttää suoraan alustan globaalia SDK:ta (wx/dd) | Riippuu alustan injektoiduista objekteista, ei puhdas Web |

Toteutusyksityiskohdat: ennen tarkistusta `stripComments` poistaa ensin kommentit (välttää kommentissa olevan esimerkkijonon virheellisen ilmoituksen),
jokaisella säännöllä on käänteisvahvistus (olemassaolon + semantiikan kaksoistarkistus).

Läpäisytuloste: `Kaikki läpäisty: 7 käyttöliittymäkuria.`

## IV. Kotisivun varmistus (`gen:csharp`)

Työpöydän C#-mallien generointikoukku `scripts/gen-csharp.mjs`:
- jäsentää aina sopimuksen ja tekee täyden kuvauksen (ketju varmistetaan jatkuvasti todellisella sopimuksella);
- kun `desktop/` puuttuu, tulostaa ohitus syyn ja **poistuu koodilla 0** (ei punaista työpöydän puuttumisen vuoksi);
- olemassa ollessa kirjoittaa `Generated/Models.g.cs` ja tekee tavutasoisen vertailun (voidaan käyttää CI:ssä).

## V. Manuaalisen hyväksynnän tarkistuslista

Kohdat, joita portit eivät kata ja jotka on tarkistettava käsin:

- **Kirjautumisen suljettu ketju**: kirjautuminen → yleiskatsaus; uloskirjautuminen → kirjautumissivu; sivun päivitys ei heitä takaisin.
- **Tokenin vanhentumisen hiljainen uudistus**: tee access-token käsin vanhentuneeksi, varmista 401:n automaattinen uudistus+toisto, huomaamaton palautus.
- **Vartijan käyttäytyminen**: ei-kirjautuneena pääsy suojattuun reittiin → ohjaus kirjautumiseen alkuperäisellä osoitteella, kirjautumisen jälkeen takaisin alkuperäiselle sivulle.
- **Käyttäjät/osastot**: tunnuksen luonti, roolin vaihto, käytöstä poisto (toinen vahvistus), yksilöllisyyskonfliktivirhe syöttökentässä,
  palvelimen haku ja sivutus.
- **Tilahallinta**: kiintiön/varmistuskynnyksen tallennus, jäädytys/sulatus, peruutus (vihje, että tiedostoja ei poisteta),
  käyttö vain luku -tilassa ilman manuaalista muokkausta.
- **429 rajoitus**: liian tiheiden epäonnistuneiden kirjautumisten kohdalla vihje „yritä myöhemmin".
- **Oikeat laitteet/selain × resoluutio**: pääasiassa työpöytäselain, huomioiden vanhemmat ytimet.

> Vuorovaikutus, tyylit ja oikean laitteen käyttäytyminen ovat porttien sokea vyöhyke; muista käydä läpi „Manuaalisen hyväksynnän tarkistuslista" ennen yhdistämistä.
