# NetDisk Web · Web-käyttöliittymä

> Yritysverkkolevyn **NetDisk** -hallintakonsolin käyttöliittymä. Vue 3 + TypeScript + pnpm workspace,
> joka jakaa saman API-mallin palvelimen ja työpöydän kanssa OpenAPI-sopimuksen kautta.

NetDisk on yritystason verkkolevyjärjestelmä: tämä säilö on sen **Web-käyttöliittymä (hallintakonsoli)**, joka tarjoaa
IT-järjestelmänvalvojille käyttäjien/osastojen, tilojen ja kiintiöiden hallinnan. Tiedostojen selailu ja siirto tapahtuvat työpöytäasiakkaassa;
tämä säilö **ei tarkoituksella toteuta online-esitystä eikä tiedostonsiirtoa** — se on tuotteen raja, ei keskeneräinen toiminto.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](../../../LICENSE)

---

## 🌐 Monikielisyys / Translations

| Kieli | README | Ominaisuusluettelo | API-opas | Koodin lukemisen opas | Arkkitehtuuri | Rakennus ja käyttöönotto | Testi |
|---|---|---|---|---|---|---|---|
| English | [README](../en/README.md) | [Feature List](../en/01-Feature-List.md) | [API Guide](../en/02-API-Guide.md) | [Code Reading Guide](../en/03-Code-Reading-Guide.md) | [Architecture](../en/04-Architecture.md) | [Build & Deploy](../en/05-Build-Deploy.md) | [Test](../en/06-Test-Document.md) |
| Deutsch | [README](../de/README.md) | [Funktionsübersicht](../de/01-Funktionsuebersicht.md) | [API-Anleitung](../de/02-API-Anleitung.md) | [Code-Leseanleitung](../de/03-Code-Leseanleitung.md) | [Architektur](../de/04-Architektur.md) | [Build & Bereitstellung](../de/05-Build-Bereitstellung.md) | [Testdokument](../de/06-Testdokument.md) |
| Français | [README](../fr/README.md) | [Liste des fonctionnalités](../fr/01-Liste-Fonctionnalites.md) | [Guide API](../fr/02-Guide-API.md) | [Guide de lecture du code](../fr/03-Guide-Lecture.md) | [Architecture](../fr/04-Architecture.md) | [Build & Déploiement](../fr/05-Build-Deploiement.md) | [Document de test](../fr/06-Document-Test.md) |
| Suomi | [README](README.md) | [Ominaisuusluettelo](01-Ominaisuusluettelo.md) | [API-opas](02-API-opas.md) | [Koodin lukemisen opas](03-Koodin-lukemisen-opas.md) | [Arkkitehtuuri](04-Arkkitehtuuri.md) | [Rakennus ja käyttöönotto](05-Rakennus-ja-kayttoonotto.md) | [Testidokumentti](06-Testidokumentti.md) |
| Русский | [README](../ru/README.md) | [Список возможностей](../ru/01-Funkcionalnyj-spisok.md) | [Руководство API](../ru/02-Rukovodstvo-API.md) | [Руководство по чтению кода](../ru/03-Rukovodstvo-po-chteniyu.md) | [Архитектура](../ru/04-Arhitektura.md) | [Сборка и развёртывание](../ru/05-Sborka-i-razvertyvanie.md) | [Тестовая документация](../ru/06-Testovaya-dokumentaciya.md) |

---

## ✨ Ominaisuudet

- **Hallintakonsoli (`apps/admin`)** — vain hallinta: kirjautuminen / yleiskatsaus / käyttäjät ja osastot / tilojen hallinta,
  rakennettu [Naive UI](https://www.naiveui.com):n päälle.
- **Sopimuksen yksilähde** — kaikki etu- ja taustapään jakamat API-mallit generoidaan tiedostosta `DOC/api/openapi.yaml`;
  kaksisuuntainen diff-portti varmistaa, etteivät generoidut tuotteet koskaan poikkea sopimuksesta.
- **Yhtenäinen API-asiakas (`packages/api`)** — tyypitetty REST-asiakas, jossa on sisäänrakennetut rakenteelliset virheet,
  tokenin injektointi ja 401-tilanteen hiljainen uudistus; **käsin kirjoitettu fetch on kielletty staattisella portilla**, kaikki pyynnöt keskittyvät tähän.
- **Tekniset portit (`scripts/`)** — sopimuksen johdonmukaisuus ja käyttöliittymäkuri (audienssi haaroittain / tokenin tallennus / vartijat /
  hiljainen uudistus, 7 sääntöä) ovat riippumattomia staattisia tarkistuksia, jotka toimivat suoraan CI:ssä.
- **Upotettava käyttöönotto** — tuotteet kopioidaan palvelimeen `pnpm build`:n jälkeen ja tarjotaan Go `embed`:in kautta, sama alkuperä ja yksi portti.

## 🧰 Teknologiapino

| Alue | Valinta |
|---|---|
| Kehys | Vue 3 (Composition API / `<script setup>`) |
| Rakennus | Vite 5 |
| Tila | Pinia |
| UI | Naive UI |
| Reititys | Vue Router 4 (History-tila, `/admin/`-alipolussa) |
| Tyypit | TypeScript (strict), vue-tsc |
| Paketinhallinta | pnpm (workspace, ≥9.15.9) |
| Sopimus | openapi-typescript (OpenAPI 3.1) |

## 📦 Pika-aloitus

Vaatimukset: Node ≥ 20, pnpm ≥ 9.15.9.

```bash
# Asenna riippuvuudet (tarkat versiot lockfile-tiedostosta)
pnpm install --frozen-lockfile

# Kehitys (Vite-kehityspalvelin, /api edustettuna osoitteeseen http://127.0.0.1:8080)
pnpm dev:admin

# Tuotantorakennus (tuloste hakemistoon apps/admin/dist, palvelimen embed-kopiota varten)
pnpm build

# Tyypin tarkistus / sopimusportti / käyttöliittymäkuri
pnpm -r typecheck
pnpm check:api
pnpm check:rules
```

## 🔁 Yleiset komennot

```bash
pnpm dev:admin     # käynnistä adminin kehityspalvelin (portti 5174)
pnpm build         # rakenna hallintakonsoli
pnpm typecheck     # tyypin tarkistus koko säilölle
pnpm lint          # lint koko säilölle
pnpm gen:api       # generoi uudelleen TS-tyypit openapi.yaml-tiedostosta
pnpm gen:csharp    # (valinnainen) generoi työpöydän C#-mallit sopimuksesta
pnpm check:api     # sopimuksen tuotteen johdonmukaisuusportti (kaksisuuntainen diff)
pnpm lint:contract # sopimuslint: estä käsin kirjoitettu fetch / samanniminen DTO
pnpm check:rules   # käyttöliittymäkurin staattinen tarkistus (7 sääntöä)
```

## 📁 Säilön rakenne

```
.
├─ apps/admin/          # hallintakonsoli (kirjautuminen/yleiskatsaus/käyttäjät-osastot/tilojen hallinta)
│  └─ src/
│     ├─ layouts/       #   AdminLayout: sivupalkki + yläpalkki
│     ├─ router/        #   reitit & vartijat
│     ├─ stores/        #   Pinia-tila (auth-store)
│     └─ views/         #   sivunäkymät
├─ packages/api/        # sopimuksesta generoitu peruskirjasto (tyypit + REST-asiakas + virhemalli)
├─ scripts/             # teknisten porttien skriptit
├─ DOC/                 # projektin dokumentaatio + OpenAPI-sopimus (DOC/api/openapi.yaml)
```

## 📚 Dokumentaatio

| Nro | Dokumentti | Kuvaus |
|---|---|---|
| 01 | [DOC/01-功能清单.md](../../../DOC/01-功能清单.md) | toimintoluettelo moduuleittain |
| 02 | [DOC/02-API指南.md](../../../DOC/02-API指南.md) | sopimuksen & API-asiakkaan opas |
| 03 | [DOC/03-代码阅读指南.md](../../../DOC/03-代码阅读指南.md) | hakemistokierros & koodin organisointi |
| 04 | [DOC/04-架构设计文档.md](../../../DOC/04-架构设计文档.md) | arkkitehtuuripäätökset & suunnittelu |
| 05 | [DOC/05-编译与部署.md](../../../DOC/05-编译与部署.md) | rakennus, tuotteen upotus & käyttöönotto |
| 06 | [DOC/06-测试文档.md](../../../DOC/06-测试文档.md) | testausstrategia & portit |

> 🌐 Yllä olevien dokumenttien monikieliset käännökset ovat yläreunan taulukossa „Monikielisyys / Translations".

## 🔐 Sopimus & yhteistyö

Rajapintasopimuksen ainoa totuudenlähde on `Doc/api/openapi.yaml` palvelinsäilössä; tämä säilö pitää
vendored-kopiota sijainnissa `DOC/api/openapi.yaml` (kolme paikkaa on pidettävä synkronoituna: palvelin / web / työpöytä).
Mikä tahansa rajapintamuutos:
1. muokkaa ensisijaista sopimusta;
2. suorita `pnpm gen:api` tyyppien uudelleengeneroimiseksi;
3. läpäise `pnpm check:api` -kaksisuuntainen diff-portti.

Älä koskaan muokkaa käsin generoitua tuotetta `packages/api/src/schema.gen.ts`.

## 🚀 CI

`.github/workflows/ci.yml` suoritetaan push/PR-toiminnassa kohteeseen `master`/`main`:
`pnpm install --frozen-lockfile → check:api → typecheck → check:rules → build →`
tarkistaa, että `apps/admin/dist/index.html` on olemassa (varmistaa, että tuote voidaan upottaa).

## 📄 Lisenssi

[Apache License 2.0](../../../LICENSE) · Copyright © 2026 NetDisk Contributors
