# Руководство по API

> **Единственный способ** вызова серверной части из фронтенда — типизированный клиент из `packages/api`.
> Рукописный fetch запрещён статическим гейтом (см. ниже «Дисциплины контракта»).

## Содержание

1. [Единый источник контракта](#1-единый-источник-контракта)
2. [Использование клиента](#2-использование-клиента)
3. [Модель ошибок](#3-модель-ошибок)
4. [Аутентификация и токены](#4-аутентификация-и-токены)
5. [Обзор интерфейсов](#5-обзор-интерфейсов)
6. [Дисциплины контракта](#6-дисциплины-контракта)

---

## 1. Единый источник контракта

Единственная истина интерфейсного контракта — в серверном репозитории `Doc/api/openapi.yaml`; в этом репозитории
находится vendored копия в `DOC/api/openapi.yaml`. После изменения контракта:

```bash
pnpm gen:api        # повторно генерирует TS-типы в packages/api/src/schema.gen.ts
pnpm check:api      # гейт двустороннего diff: артефакт должен совпадать с контрактом
```

`packages/api/src/schema.gen.ts` — это **артефакт, запрещено править вручную**. Точка входа типов:

```ts
import type { components, operations, paths, Schema } from "@netdisk/api";
// Schema = components["schemas"] —— все модели контракта
```

## 2. Использование клиента

`Client` — единственная точка входа REST, открывает только метод `request` (плюс низкоуровневый `send`).

```ts
import { Client } from "@netdisk/api";

const c = new Client({
  getToken: () => this.token,          // внедрение текущего access token
  onUnauthorized: () => this.refresh(), // колбэк тихого обновления при 401
});

// JSON-запрос
const me = await c.request<Record<string, unknown>>("/api/v1/me");

// с параметрами запроса
const res = await c.request<{ users: User[]; total: number }>(
  `/api/v1/admin/users?${new URLSearchParams({ limit: "20" }).toString()}`,
);

// запись
await c.request("/api/v1/admin/departments", {
  method: "POST",
  body: { parent_id: "", name: "Разработка" },
});
```

Ключевое поведение:

- **Внедрение токена**: автоматически добавляет `Authorization: Bearer <token>`.
- **Тихое обновление при 401**: при наличии `onUnauthorized` сначала обновляет, затем **повторяет один раз** исходный запрос.
- **Бинарное тело**: `Blob`/`FormData`/`ArrayBuffer` отправляются как есть, `Content-Type` не задаётся по своему усмотрению
  (чтобы поэтапная загрузка не сериализовалась в пустой объект).
- **Структурированная ошибка**: любой не-2xx бросает `APIError` (см. ниже).
- **Тот же источник**: по умолчанию baseURL пуст, тот же источник с бэкендом (`credentials: "same-origin"`).

Логика владения токеном и обновления находится у вызывающей стороны (в `stores/auth.ts`); клиент отвечает только за отправку и повтор.

## 3. Модель ошибок

Все ошибки единообразно бросают `APIError`, вызывающая сторона распределяет по `code`, **не разбирая текст message**:

```ts
import { APIError } from "@netdisk/api";

try {
  await c.request(...);
} catch (e) {
  if (e instanceof APIError) {
    // e.status    —— HTTP-код состояния
    // e.code      —— бизнес-код ошибки (например account_conflict)
    // e.details   —— структурированная доп. информация (например details.field конфликтующего поля)
    // e.requestId —— ID запроса для диагностики
    // удобные предикаты:
    //   e.isAuthError     —— status === 401
    //   e.isSpaceRevoked  —— code ∈ {space_revoked, space_gone}
  }
}
```

## 4. Аутентификация и токены

Процесс входа в админ-панель находится в `apps/admin/src/stores/auth.ts`:

- При входе передаётся `audience: "web"` (аудитория по веткам; ошибка проявляется как «вход успешен, но все интерфейсы дают 403»).
- access token и refresh token хранятся только в **sessionStorage** (безопасно для общей машины).
- При истечении `refresh()` меняет refresh token на новый access token, после успеха заполняет и повторяет запрос;
  при неудачном обновлении только тогда `logout()` возвращает на страницу входа.
- Охранник маршрута не переходит до `auth.ready`, чтобы избежать мерцания при обновлении страницы; при отсутствии входа переходит на страницу входа и
  **сохраняет исходный адрес** через параметр запроса `redirect`.

## 5. Обзор интерфейсов

Интерфейсы первой фазы, покрытые контрактом (полное определение в `DOC/api/openapi.yaml`):

| Категория | Конечная точка | Описание |
|---|---|---|
| auth | `GET /api/v1/version`, `GET /api/v1/me` | Версия, текущий вошедший |
| auth | `POST /api/v1/auth/{login,refresh,logout}` | Вход/обновление/выход |
| files | `GET /api/v1/files`, `files/dirs`, `files/{id}` | Список файлов/каталогов и детали |
| files | `files/{id}/content`, `move`, `copy`, `subtree-stats`, `share-to-space`, `lock` | Содержимое/перемещение/копирование/статистика/шаринг/блокировка |
| upload | `POST /api/v1/upload/create`, `{id}`, `{id}/finish` | Поэтапная загрузка |
| sync | `GET /api/v1/changes`, `changes/head`, `sync/cursors` | Поток изменений/курсоры |
| shares | `shares`, `shares/{id}`, `shares/{token}/meta`, `.../download` | Шаринг |
| admin | `departments`, `departments/{id}` | Отделы (admin) |
| admin | `spaces`, `spaces/{id}` и др. | Список/детали управления пространствами |
| admin | `admin/users`, `admin/departments`, `admin/spaces/{id}/freeze` и др. | Управление пользователями/отделами/пространствами |

> Админ-панель сейчас в основном потребляет: `auth/*`, `me`, `admin/users`, `admin/departments`,
> `admin/spaces` (вкл. quota/freeze/revoke).

## 6. Дисциплины контракта

`pnpm lint:contract` (ядро `check:api`) принуждает к трём вещам, чтобы «единый источник контракта» не обходился:
**рукописный fetch блокируется**, **рукописный DTO с тем же именем блокируется**, **устаревший артефакт блокируется**. Полные правила и
вывод прохождения/ошибки см. в **06-Testovaya-dokumentaciya«Гейты контракта»**.
