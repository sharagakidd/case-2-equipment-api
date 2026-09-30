# Equipment API

REST API на Express для учёта заявок на обслуживание оборудования производственной площадки:
справочник техники, заявки на обслуживание, контроль жизненного цикла заявки и проверка погодных
условий на объекте перед планированием наружных работ.

Данные хранятся в PostgreSQL (доступ через Sequelize), и только через слой репозиториев —
сервисы и контроллеры не знают, где именно лежат записи.

## Требования

- Node.js 18+ (проект проверен на v24.20.0; Express 5 требует Node.js ≥ 18)
- npm 9+

## Установка

```bash
git clone <URL>
cd case-2-equipment-api
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

## Переменные окружения

| Переменная | Значение по умолчанию | Назначение |
|---|---|---|
| `PORT` | `3000` | порт HTTP-сервера |
| `NODE_ENV` | `development` | окружение; в `development` логи идут через pino-pretty |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | белый список origin'ов, разделитель — запятая |
| `RATE_LIMIT_WINDOW_MS` | `60000` | окно ограничения частоты запросов, мс |
| `RATE_LIMIT_MAX` | `100` | максимум запросов в окне с одного IP |
| `LOG_LEVEL` | `info` | уровень логирования (`debug`, `info`, `warn`, `error`, `fatal`) |
| `WEATHER_API_URL` | `https://geocoding-api.open-meteo.com/v1/search` | адрес геокодинга Open-Meteo (в текущей версии не используется) |
| `FORECAST_API_URL` | `https://api.open-meteo.com/v1/forecast` | адрес прогноза Open-Meteo |
| `REQUEST_TIMEOUT_MS` | `5000` | таймаут запроса к внешнему API, мс |
| `MAX_WIND_SPEED` | `10` | порог ветра для пригодности окна, км/ч |
| `MAX_PRECIPITATION` | `0` | допустимая сумма осадков за окно, мм |

`CORS_ORIGINS`, `WEATHER_API_URL` и `FORECAST_API_URL` обязательны: если переменная не задана,
приложение падает на старте с сообщением `Не задана обязательная переменная окружения: <имя>`.

### Подключение к базе

Два набора переменных на одну и ту же базу: `POSTGRES_*` читает docker compose (создание базы
в контейнере), `PG*` — приложение и sequelize-cli (`src/db/config.js`). Значения обязаны совпадать,
иначе миграции уйдут не в ту базу, которая поднята в контейнере.

| Переменная | Значение в `.env.example` | Кто читает | Назначение |
|---|---|---|---|
| `POSTGRES_DB` | `equipment_api` | docker compose | имя базы, создаваемой при первом старте контейнера |
| `POSTGRES_USER` | `app` | docker compose | пользователь-владелец базы |
| `POSTGRES_PASSWORD` | (пусто) | docker compose | пароль владельца; в локальном `.env` — `devpass` |
| `PGHOST` | `localhost` | sequelize, sequelize-cli | хост базы; публикуется как `127.0.0.1:5432` |
| `PGPORT` | `5432` | sequelize, sequelize-cli | порт базы |
| `PGDATABASE` | `equipment_api` | sequelize, sequelize-cli | имя базы для подключения приложения |
| `PGUSER` | `app` | sequelize, sequelize-cli | пользователь для подключения |
| `PGPASSWORD` | (пусто) | sequelize, sequelize-cli | пароль для подключения; локально `devpass` |

Порядок миграций и сидов задаётся именами файлов (`01-create-sites.js` … `07-create-request-assignees.js`),
пути к папкам — в `.sequelizerc` (`migrations-path`, `seeders-path`, `models-path`, `config`).


## Запуск

Порядок запуска: база → схема → данные → приложение.

```bash
docker compose up -d              # 1. PostgreSQL 18 в контейнере, порт 127.0.0.1:5432
npx sequelize-cli db:migrate      # 2. применить миграции 01…07: таблицы, enum-типы, индексы
npx sequelize-cli db:seed:all     # 3. справочники и демонстрационные данные
npm run dev                       # 4. запустить API (nodemon: перезапуск при изменении файлов)
```

`npm run dev` — разработка, `npm start` — обычный запуск. Шаги 1–3 выполняются один раз:
повторный `db:seed:all` пропускает уже применённые сиды, их список хранится в служебной таблице
`SequelizeData` (`seederStorage: 'sequelize'` в `src/db/config.js`). Перед запуском нужен `.env`
(см. «Переменные окружения») — контейнер и приложение читают из него разные наборы переменных.

Проверка готовности: `docker compose ps` (статус `healthy`) и `npx sequelize-cli db:migrate:status`.

Сервер слушает `http://localhost:3000`, базовый путь API — `/api`. При остановке (Ctrl+C, SIGTERM)
работает graceful shutdown: сервер перестаёт принимать соединения, ждёт завершения текущих
и только затем выходит.

### Откат миграций и сидов

```bash
npx sequelize-cli db:seed:undo:all       # убрать данные сидов (по служебной таблице)
npx sequelize-cli db:migrate:undo        # откатить последнюю применённую миграцию (07)
npx sequelize-cli db:migrate:undo:all     # откатить всю схему до пустой базы
npx sequelize-cli db:migrate:undo --name <имя миграции без .js>   # откатить конкретную миграцию
```

Откат идёт в обратном порядке — от зависимых таблиц к справочникам, поэтому внешние ключи
не мешают и данные не приходится чистить вручную:

```text
07 request_assignees → 06 request_status_history → 05 maintenance_requests →
04 technicians → 03 equipment_passports → 02 equipment → 01 sites
```

В `down` каждой миграции, кроме удаления таблицы, явно выполняется `DROP TYPE IF EXISTS …`:
`dropTable` не удаляет enum-типы PostgreSQL, и без этого повторный `db:migrate` упал бы на
«type … already exists». Откат схемы удаляет данные безвозвратно — сначала сохраните дамп:

```bash
docker compose exec db pg_dump -U app equipment_api > dump.sql
```


## Модель данных

### Equipment (оборудование)

| Поле | Тип | Правила |
|---|---|---|
| `id` | string | UUID, генерируется сервером |
| `name` | string | 3–100 символов, обязательное |
| `type` | string | `turbine` \| `inverter` \| `sensor` \| `substation` |
| `serialNumber` | string | непустой, уникальный в пределах системы |
| `siteId` | string \| null | UUID площадки; необязательное поле, `null` — оборудование вне площадки, несуществующий id даёт `422` |
| `location` | object | `{ lat: -90…90, lon: -180…180 }` |
| `status` | string | `operational` \| `maintenance` \| `fault` \| `decommissioned`; при создании по умолчанию `operational` |
| `installedAt` | string | ISO-дата, не в будущем |

### Request (заявка на обслуживание)

| Поле | Тип | Правила |
|---|---|---|
| `id` | string | UUID, генерируется сервером |
| `equipmentId` | string | UUID существующего оборудования (проверяется при создании) |
| `title` | string | 5–120 символов, обязательное |
| `description` | string | до 2000 символов |
| `priority` | string | `low` \| `medium` \| `high` \| `critical`; по умолчанию `medium` |
| `status` | string | `new` \| `in_progress` \| `done` \| `rejected`; при создании всегда `new` |
| `plannedAt` | string | ISO-дата-время, необязательное |
| `createdAt`, `updatedAt` | string | ISO-дата-время, проставляются сервером |

Служебные поля `id`, `createdAt`, `updatedAt` через API изменить нельзя. Неизвестные поля тела
запроса игнорируются (не приводят к ошибке). Идентификатор в пути (`:id`) проверяется как UUID —
некорректный формат даёт `422`.

## ER-диаграмма

```text
sites
 └─ 1:N ─> equipment
             ├─ 1:1 ─> equipment_passports
             └─ 1:N ─> maintenance_requests
                         ├─ 1:N ─> request_status_history
                         └─ N:M ─> technicians        (через request_assignees)
```

Читается так: у площадки много единиц оборудования, у единицы оборудования не больше одного
паспорта, заявки привязаны к единице оборудования, история статусов — к заявке, а исполнители
связаны с заявками через таблицу `request_assignees`. Типы полей, ключи и правила удаления — ниже.

## Схема данных

Семь таблиц: четыре основные (`sites`, `equipment`, `technicians`, `maintenance_requests`) и три
зависимые (`equipment_passports`, `request_status_history`, `request_assignees`). Все первичные
ключи — UUID, значение генерирует база (`gen_random_uuid()`, встроена в PostgreSQL 13+).
Имена колонок взяты из миграций (`snake_case`); исключение — метки времени `createdAt`/`updatedAt`
(значения по умолчанию Sequelize, поэтому в кавычках они пишутся именно так).

### sites — площадки

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `name` | varchar(120) | NOT NULL |
| `code` | varchar(32) | NOT NULL, UNIQUE |
| `region` | varchar(120) | NOT NULL |
| `lat`, `lon` | numeric(9,6) | NOT NULL |
| `createdAt`, `updatedAt` | timestamptz | NOT NULL, по умолчанию `CURRENT_TIMESTAMP` |

### equipment — оборудование

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | uuid | PK |
| `site_id` | uuid | NULL, FK → `sites.id` |
| `name` | varchar(100) | NOT NULL |
| `type` | enum: `turbine`, `inverter`, `sensor`, `substation` | NOT NULL |
| `serial_number` | varchar(64) | NOT NULL, UNIQUE |
| `status` | enum: `operational`, `maintenance`, `fault`, `decommissioned` | NOT NULL, по умолчанию `operational` |
| `installed_at` | timestamptz | NULL |
| `lat`, `lon` | numeric(9,6) | NULL — координаты единицы могут отличаться от центра площадки |
| `createdAt`, `updatedAt` | timestamptz | NOT NULL |

Индексы: `equipment_site_id_idx` и `equipment_status_idx` — внешние ключи PostgreSQL сам не индексирует,
а `status` часто используется в фильтрах API.

### equipment_passports — паспорт оборудования

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | uuid | PK |
| `equipment_id` | uuid | NOT NULL, UNIQUE, FK → `equipment.id` |
| `manufacturer` | varchar(120) | NOT NULL |
| `model` | varchar(120) | NOT NULL |
| `rated_power` | numeric(10,2) | NULL |
| `last_inspection_at` | timestamptz | NULL |
| `createdAt`, `updatedAt` | timestamptz | NOT NULL |

### technicians — техники

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | uuid | PK |
| `full_name` | varchar(150) | NOT NULL |
| `specialization` | varchar(120) | NOT NULL |
| `employee_number` | varchar(32) | NOT NULL, UNIQUE |
| `createdAt`, `updatedAt` | timestamptz | NOT NULL |

### maintenance_requests — заявки на обслуживание

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | uuid | PK |
| `equipment_id` | uuid | NOT NULL, FK → `equipment.id` |
| `title` | varchar(120) | NOT NULL |
| `description` | text | NULL |
| `priority` | enum: `low`, `medium`, `high`, `critical` | NOT NULL, по умолчанию `medium` |
| `status` | enum: `new`, `in_progress`, `done`, `rejected` | NOT NULL, по умолчанию `new` |
| `planned_at` | timestamptz | NULL |
| `author` | varchar(120) | NULL |
| `createdAt`, `updatedAt` | timestamptz | NOT NULL |

Индексы: `maintenance_requests_equipment_id_idx` и `maintenance_requests_status_idx`.

### request_status_history — история смен статуса

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | uuid | PK |
| `request_id` | uuid | NOT NULL, FK → `maintenance_requests.id` |
| `old_status` | enum (те же четыре статуса) | NULL — первая запись создаётся вместе с заявкой, перехода ещё не было |
| `new_status` | enum (те же четыре статуса) | NOT NULL |
| `author` | varchar(120) | NULL |
| `comment` | text | NULL |
| `created_at` | timestamptz | NOT NULL, `CURRENT_TIMESTAMP` |

Таблица только на добавление: есть `created_at` и нет `updatedAt`, поэтому записи истории
не переписываются. Индекс `request_status_history_request_id_idx` ускоряет выборку истории
и каскадное удаление.

### request_assignees — исполнители заявки

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | uuid | PK |
| `request_id` | uuid | NOT NULL, FK → `maintenance_requests.id` |
| `technician_id` | uuid | NOT NULL, FK → `technicians.id` |
| `role` | enum: `lead`, `member` | NOT NULL |
| `hours` | numeric(6,2) | NULL |

UNIQUE (`request_id`, `technician_id`) — техник не может быть назначен на заявку дважды;
индекс `request_assignees_technician_id_idx` обслуживает обратный поиск «в каких заявках участвует
техник». Меток времени у таблицы нет: это связка, а не самостоятельная сущность.

Служебные таблицы Sequelize — `SequelizeMeta` (применённые миграции) и `SequelizeData` (применённые
сиды) — в схему API не входят.

## Связи между таблицами

| Связь | Как задана | Что значит |
|---|---|---|
| `sites` → `equipment` | 1:N, `equipment.site_id` | на площадке много единиц оборудования; `site_id` допускает NULL, то есть единица может быть не привязана к площадке |
| `equipment` → `equipment_passports` | 1:1, `equipment_passports.equipment_id` UNIQUE | паспорт либо один, либо его нет; двух паспортов у единицы быть не может |
| `equipment` → `maintenance_requests` | 1:N, `maintenance_requests.equipment_id` | у единицы много заявок, каждая заявка относится ровно к одной единице |
| `maintenance_requests` → `request_status_history` | 1:N, `request_status_history.request_id` | каждая смена статуса — отдельная строка, история только растёт |
| `maintenance_requests` ↔ `technicians` | N:M через `request_assignees` | в заявке несколько исполнителей, техник участвует в нескольких заявках; атрибуты связи — `role` и `hours` |

Правило «в заявке ровно один ведущий» в схеме не выражено: частичный уникальный индекс
(`request_id` при `role = 'lead'`) допускал бы и ноль, и один; проверяет его сервисный слой
и отвечает `422`. Техники — независимый справочник, он ни на кого не ссылается, ссылаются на него.

## Нормализация и обоснование (3NF)

**Первая нормальная форма.** Все колонки атомарны: списков и составных значений в одном поле нет.
Несколько исполнителей заявки — это отдельные строки `request_assignees`, а не строка
«Иванов, Петров». Статусы, приоритеты и типы хранятся enum-типами, а не свободным текстом.

**Вторая нормальная форма.** У каждой таблицы суррогатный первичный ключ (`id` uuid), составных
ключей нет, поэтому частичных зависимостей от части ключа быть не может. Уникальность пары
«заявка + техник» вынесена в отдельное ограничение UNIQUE, а не в составной первичный ключ.

**Третья нормальная форма.** Транзитивных зависимостей нет — каждый факт хранится в одном месте.

- Справочники отделены от фактов: название, код и регион площадки лежат только в `sites`, а
  `equipment` ссылается на них через `site_id`; ФИО и специализация техника — только в
  `technicians`. Описания в дочерних таблицах не дублируются, обновление справочника — одна строка.
- Атрибуты зависят только от ключа своей таблицы: `title`, `priority`, `status` — от заявки,
  а `role` и `hours` — от пары «заявка + техник», потому что это атрибуты связи, а не заявки
  или техника.
- Вычисляемых и агрегированных значений в таблицах нет: число заявок, часы исполнителей и дата
  последнего ремонта считаются запросом (`/api/reports/equipment-load`, сводка по площадке),
  поэтому счётчики не могут разойтись с данными.
- История статусов — отдельная таблица только на добавление, а не повторяющееся поле в заявке:
  новая смена статуса не перезаписывает предыдущую.

**Что нарушило бы третью форму и почему так не сделано.**

- Хранить `siteName`/`region` в `equipment` — дублирование справочника: при переименовании площадки
  пришлось бы править много строк.
- Хранить в `equipment` число заявок или суммарные часы — кэш агрегатов, который надо
  синхронизировать при каждом изменении заявки.
- Хранить исполнителей строкой в заявке — нарушение первой формы и невозможность обратного поиска
  «в каких заявках участвует техник».
- Хранить историю статусов массивом JSON в заявке — не атомарно и не фильтруется по переходам.

**Осознанные отступления.**

- `equipment.lat`/`lon` дублируют координаты площадки: единица может стоять в стороне от её центра,
  а может быть вообще не привязана к площадке (`site_id` допускает NULL).
- `author` в заявке и в истории — свободный текст: справочника пользователей нет, аутентификации
  в API нет, выносить имена в отдельную таблицу нечего.
- Денормализация ради скорости не применялась: выборки читаются одним-двумя запросами с индексами
  по внешним ключам и статусам. При росте данных отчёты переводятся на материализованное
  представление без изменения схемы.

## Правила удаления (ON DELETE)

Правило задано у каждого внешнего ключа в миграциях. Логика выбора: дочерняя запись удаляется
вместе с родителем только тогда, когда без родителя она бессмысленна.

| Внешний ключ | ON DELETE | Почему так |
|---|---|---|
| `equipment.site_id` → `sites.id` | RESTRICT | площадку нельзя удалить, пока на ней числится оборудование, иначе единицы остались бы без места размещения |
| `equipment_passports.equipment_id` → `equipment.id` | CASCADE | паспорт — часть единицы оборудования (связь 1:1), без неё он ничего не описывает |
| `maintenance_requests.equipment_id` → `equipment.id` | RESTRICT | заявки — история работ: вместе с оборудованием нельзя терять, что и когда ремонтировали |
| `request_status_history.request_id` → `maintenance_requests.id` | CASCADE | история смен статуса существует только внутри заявки |
| `request_assignees.request_id` → `maintenance_requests.id` | CASCADE | назначение без заявки лишено смысла |
| `request_assignees.technician_id` → `technicians.id` | RESTRICT | техника нельзя удалить, пока он назначен в заявки; справочник защищён от ссылок в пустоту |

Защита двухуровневая. Приложение: `DELETE /api/equipment/:id` возвращает `409`, если у оборудования
есть открытые заявки. База: если запрос обошёл сервис, PostgreSQL остановит удаление по RESTRICT
или уберёт зависимые строки по CASCADE. Выбран RESTRICT, а не NO ACTION, потому что проверка
срабатывает сразу, а не в конце транзакции.

Коды ошибок целостности в ответах: ссылка на несуществующую запись при создании или обновлении
(`23503`) — `422` с текстом про связанную запись; запрет удаления, когда на строку ссылаются
(`23503` и `23001`, который PostgreSQL отдаёт для RESTRICT) — `409` «на неё ссылаются другие
данные»; дубль по уникальному индексу — тоже `409`. Ни один из этих случаев не превращается в `500`:
Sequelize не заворачивает `23001` в `ForeignKeyConstraintError`, поэтому репозиторий и обработчик
ошибок распознают код драйвера отдельно.

## Эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/health` | проверка доступности сервиса (в логи не пишется) |
| GET | `/api/equipment` | список оборудования: фильтры, сортировка, пагинация |
| POST | `/api/equipment` | создание единицы оборудования |
| GET | `/api/equipment/:id` | карточка оборудования |
| PATCH | `/api/equipment/:id` | частичное обновление |
| DELETE | `/api/equipment/:id` | удаление; `409`, если по оборудованию есть заявки (открытые проверяет сервис, остальные — внешний ключ) |
| GET | `/api/equipment/:id/requests` | заявки по конкретной единице оборудования |
| GET | `/api/equipment/:id/weather` | прогноз по координатам объекта и пригодность окна для работ |
| GET | `/api/requests` | список заявок: фильтры, сортировка, пагинация |
| POST | `/api/requests` | создание заявки |
| GET | `/api/requests/:id` | карточка заявки |
| PATCH | `/api/requests/:id` | редактирование полей заявки (статус этим методом не меняется) |
| PATCH | `/api/requests/:id/status` | смена статуса с проверкой допустимости перехода |
| DELETE | `/api/requests/:id` | удаление заявки |
| POST | `/api/requests/:id/assignees` | назначение бригады заявки (ровно один `lead`) |
| DELETE | `/api/requests/:id/assignees/:userId` | снятие исполнителя с заявки |
| GET | `/api/requests/:id/history` | история смен статуса заявки |
| GET | `/api/sites/:id/summary` | сводка по площадке: оборудование, заявки, часы |
| GET | `/api/reports/equipment-load` | аналитика по загрузке оборудования (raw SQL) |

Формат ответов: одиночная сущность — `{ "data": { … } }`, список — `{ "data": [ … ], "meta": { "total": n, "page": 1, "limit": 20, "totalPages": m } }`.
Создание возвращает `201` и заголовок `Location` с адресом новой сущности, удаление — `204` без тела.

Параметры списков (все необязательные, кроме значений по умолчанию):

| Эндпоинт | Поддерживаемые параметры запроса |
|---|---|
| `GET /api/equipment` | `page` (по умолчанию 1), `limit` (20, максимум 100), `status`, `type`, `sortBy`, `order` (`asc`/`desc`) |
| `GET /api/requests` | `page`, `limit`, `status`, `priority`, `equipmentId`, `sortBy`, `order` |
| `GET /api/equipment/:id/requests` | `page`, `limit`, `status`, `priority`, `sortBy`, `order` |
| `GET /api/reports/equipment-load` | `siteId` — ограничить выборку одной площадкой |

`sortBy` принимает имя поля сущности, для убывания используйте `order=desc`. Некорректные значения
этих параметров дают `422`; неизвестные параметры просто игнорируются.

Интерактивная документация — Swagger UI на `/api/docs`: спецификация собирается из `@openapi`-аннотаций
в файлах роутов. Публичные эндпоинты (auth, health, `/metrics`) отмечены в ней `security: []`.

## Переходы статусов заявки

Допустимые переходы:

```text
new → in_progress → done
new → rejected
in_progress → rejected
```

Статусы `done` и `rejected` — терминальные: переходы из них запрещены. Любая недопустимая смена
статуса (в том числе повторная установка текущего статуса) отклоняется с кодом `409`:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Недопустимый переход статуса: new → done",
    "requestId": "b1f2c3d4-7a1e-4f2b-9c3d-0123456789ab"
  }
}
```

Смена статуса выполняется только через `PATCH /api/requests/:id/status`. Обычный
`PATCH /api/requests/:id` это поле игнорирует, поэтому обойти правила переходов нельзя.

## Бригада заявки

`POST /api/requests/:id/assignees` задаёт состав бригады целиком: прежние назначения
удаляются, поэтому число строк в `request_assignees` не растёт при повторных вызовах.
В теле обязателен ровно один исполнитель с ролью `lead`, дубли техников и пустой список
отклоняются с `422`, несуществующий техник даёт `404`. Поле `hours` необязательно.

```json
{
  "assignees": [
    { "technicianId": "9c48a077-6705-46ee-a418-08c33c601e2a", "role": "lead", "hours": 4 },
    { "technicianId": "600fc002-a322-4fa3-b3cd-8e7169b8fd7a", "role": "member" }
  ]
}
```

Оба маршрута отвечают без тела заявки: `POST` возвращает `201`, адрес бригады в заголовке
`Location` и карточку заявки с новым составом `assignees`, `DELETE` — `204` без тела
(в `:userId` — идентификатор техника; `404`, если такого исполнителя у заявки нет).

## Сводка по площадке

`GET /api/sites/:id/summary` отдаёт карточку площадки и агрегаты по ней: оборудование и
заявки по статусам (нулевые статусы тоже присутствуют) плюс суммарные часы исполнителей.

```json
{
  "data": {
    "site": { "id": "1fcf…", "name": "Ветропарк Северный", "code": "VN-01", "region": "Мурманская область", "location": { "lat": 68.958333, "lon": 33.082778 } },
    "equipment": { "total": 3, "byStatus": { "operational": 1, "maintenance": 1, "fault": 1, "decommissioned": 0 } },
    "requests": { "total": 14, "open": 8, "byStatus": { "new": 4, "in_progress": 4, "done": 4, "rejected": 2 } },
    "assignees": { "plannedHours": 40.5 }
  }
}
```

## Отчёт по загрузке оборудования

`GET /api/reports/equipment-load` — аналитика по каждой единице оборудования одним запросом к базе
(raw SQL в `src/repositories/ReportRepository.js`): счётчики заявок и часы исполнителей считаются
подзапросами, поэтому join не размножает строки. Пагинации нет: ответ — `{ "data": [ … ] }`,
самая нагруженная техника идёт первой.

| Параметр | Тип | Обязательный | Поведение |
|---|---|---|---|
| `siteId` | UUID | нет | ограничивает выборку одной площадкой |

Примеры параметров:

```bash
# все площадки
curl 'http://localhost:3000/api/reports/equipment-load'

# только оборудование площадки
curl 'http://localhost:3000/api/reports/equipment-load?siteId=1fcf1c2e-0d4e-4b9a-9c1e-2f3a4b5c6d7e'

# невалидный UUID — 422, неизвестный UUID — 200 и пустой "data"
curl -i 'http://localhost:3000/api/reports/equipment-load?siteId=not-a-uuid'
```

Без параметра считаются все площадки; неизвестный, но валидный `siteId` не ошибка — вернётся
пустой список (площадка без оборудования допустима); невалидный UUID отсекает валидация с `422`.
Фильтр по площадке применяется к оборудованию, у которого площадка не указана (`site_id IS NULL`),
такие строки в выборку с `siteId` не попадают.


```json
{
  "data": [
    {
      "id": "7cd9ca48-99da-4e05-a51c-dcb81b79d684",
      "name": "Ветротурбина №3",
      "type": "turbine",
      "serialNumber": "SN-WT-0003",
      "equipmentStatus": "fault",
      "siteId": "1fcf…",
      "siteName": "Ветропарк Северный",
      "totalRequests": 5,
      "openRequests": 3,
      "overdueRequests": 2,
      "doneRequests": 1,
      "plannedHours": 4,
      "lastRequestAt": "2026-09-25T00:00:00.000Z"
    }
  ]
}
```

В `src/repositories/ReportRepository.js` отчёт собран на подзапросах, а в
`src/repositories/reportsRepository.js` лежит вариант того же отчёта одним запросом с параметрами
`from`, `to` и `minRequests` (`GROUP BY … HAVING`, значения уходят через `bind`); к маршруту этот
вариант пока не подключён.

## Формат ошибок

Все ошибки отдаются в едином формате (`Content-Type: application/json`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Ошибка валидации данных",
    "details": [{ "field": "priority", "message": "Недопустимое значение" }],
    "requestId": "b1f2c3d4-7a1e-4f2b-9c3d-0123456789ab"
  }
}
```

| `code` | HTTP | Когда возникает |
|---|---|---|
| `VALIDATION_ERROR` | 422 | невалидные `body`, `query` или `params`; `details` содержит список полей с причинами |
| `NOT_FOUND` | 404 | сущность или маршрут не найдены; техника не существует при создании заявки |
| `CONFLICT` | 409 | дубль `serialNumber`, удаление техники с открытыми заявками, недопустимый переход статуса |
| `RATE_LIMIT_EXCEEDED` | 429 | превышен `RATE_LIMIT_MAX`; в ответе есть заголовок `Retry-After` |
| `INTERNAL_ERROR` | 500 | непредвиденная ошибка; наружу не уходят стек-трейсы и внутренние детали |

`requestId` совпадает с заголовком `X-Request-Id` ответа и с идентификатором запроса в логах —
по нему можно найти все записи по конкретному запросу. Поле `details` есть только у ошибок валидации.

## Примеры запросов

Создание оборудования:

```bash
curl -X POST http://localhost:3000/api/equipment \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Турбина №1",
    "type": "turbine",
    "serialNumber": "TUR-001",
    "location": { "lat": 55.7558, "lon": 37.6173 },
    "installedAt": "2024-06-15T08:30:00Z"
  }'
```
```json
201 Created
Location: /api/equipment/257aea5a-4d9d-47b2-b064-cd013793fa27

{
  "data": {
    "name": "Турбина №1", "type": "turbine", "serialNumber": "TUR-001",
    "location": { "lat": 55.7558, "lon": 37.6173 },
    "status": "operational", "installedAt": "2024-06-15T08:30:00Z",
    "id": "257aea5a-4d9d-47b2-b064-cd013793fa27",
    "createdAt": "2026-09-20T12:21:17.124Z",
    "updatedAt": "2026-09-20T12:21:17.124Z"
  }
}
```

Список с фильтром и сортировкой:

```bash
curl 'http://localhost:3000/api/equipment?status=operational&sortBy=installedAt&order=desc&limit=10'
```
```json
200 OK
{
  "data": [ { "id": "257aea5a-4d9d-47b2-b064-cd013793fa27", "name": "Турбина №1", "status": "operational", "…": "…" } ],
  "meta": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
}
```

Создание заявки и смена статуса:

```bash
curl -X POST http://localhost:3000/api/requests \
  -H 'Content-Type: application/json' \
  -d '{ "equipmentId": "257aea5a-4d9d-47b2-b064-cd013793fa27",
        "title": "Замена подшипника", "priority": "high" }'

curl -X PATCH http://localhost:3000/api/requests/8052dc6c-ad1c-48a7-a3f0-917a736fc144/status \
  -H 'Content-Type: application/json' -d '{ "status": "in_progress" }'
```
```json
201 Created   { "data": { "status": "new", "priority": "high", "…": "…" } }
200 OK        { "data": { "status": "in_progress", "…": "…" } }
```

Прогноз и пригодность окна:

```bash
curl http://localhost:3000/api/equipment/257aea5a-4d9d-47b2-b064-cd013793fa27/weather
```
```json
200 OK
{
  "data": {
    "equipment": { "id": "257aea5a-4d9d-47b2-b064-cd013793fa27", "name": "Турбина №1", "…": "…" },
    "forecast": {
      "time": ["2026-09-20", "2026-09-21", "2026-09-22"],
      "temperature_2m_max": [18.7, 19.3, 18.7],
      "temperature_2m_min": [9.9, 13.3, 13.2],
      "precipitation_sum": [0, 0, 17.4],
      "wind_speed_10m_max": [11.4, 11.9, 10.5]
    },
    "suitable": false,
    "reasons": ["Сильный ветер", "Осадки"]
  }
}
```

Примеры ошибочных ответов:

```bash
# 422 — невалидное тело (name короче 3 символов)
curl -X POST http://localhost:3000/api/equipment -H 'Content-Type: application/json' -d '{ "name": "AB" }'

# 409 — серийный номер уже занят
curl -X POST http://localhost:3000/api/equipment -H 'Content-Type: application/json' \
  -d '{ "name": "Турбина №2", "type": "turbine", "serialNumber": "TUR-001",
        "location": { "lat": 55.7, "lon": 37.6 }, "installedAt": "2024-06-15T08:30:00Z" }'

# 404 — заявка на несуществующее оборудование
curl -X POST http://localhost:3000/api/requests -H 'Content-Type: application/json' \
  -d '{ "equipmentId": "00000000-0000-0000-0000-000000000000", "title": "Ремонт насоса" }'
```
```json
422 { "error": { "code": "VALIDATION_ERROR", "message": "Ошибка валидации данных",
                 "details": [ { "field": "name", "message": "Too small: expected string to have >=3 characters" } ],
                 "requestId": "5a1e5416-d9c2-48ce-b8fe-f6417ae96608" } }
409 { "error": { "code": "CONFLICT", "message": "Оборудование с таким серийным номером уже существует",
                 "requestId": "8b81f649-8a93-4e9e-ae01-a23b025b54f3" } }
404 { "error": { "code": "NOT_FOUND", "message": "Оборудование не найден",
                 "requestId": "3b8977ae-c56e-4a93-aa61-49c9099bdf67" } }
429 { "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Слишком много запросов, попробуйте позже",
                 "requestId": "cbf8f6b3-0488-4b6d-b2ca-0e36f16d0da5" } }
```

## Коллекция Postman

Готовая коллекция лежит в `docs/postman/equipment-api.postman_collection.json` (`Equipment API`,
схема v2.1.0). Переменная `baseUrl` уже указывает на `http://localhost:3000/api`, остальные значения
заданы из сидов или заполняются ответами предыдущих запросов.

| Папка | Что проверяет |
|---|---|
| `Health` | доступность сервиса |
| `Equipment` | CRUD, список с фильтрами, заявки и прогноз по единице оборудования |
| `Requests` | создание, список, правка, смена статуса, удаление |
| `Negative` | `404`, `422`, `409`, `429` на некорректных данных |
| `Assignees` | назначение бригады → `201` и заголовок `Location`, два `lead` и вариант без `lead` → `422`, снятие исполнителя → `204` |
| `History` | история смены статуса заявки → `200` |
| `Sites` | сводка по площадке → `200` |
| `Reports` | отчёт по загрузке оборудования с параметром `siteId` и без него → `200` |
| `Negative Sequelize` | дубль серийного номера → `409`, ссылка на несуществующую площадку → `422` |

Порядок прогона: `Equipment → Create equipment` заполняет переменную `equipmentId`,
`Requests → Create request` — `requestId`; от них зависят тесты бригады и внешнего ключа.
Каждый элемент содержит сохранённый пример ответа и скрипты `pm.test` с проверкой статуса и тела.
Переменные `siteId`, `technicianId`, `technicianId2`, `historyRequestId` — данные из сидов:
после повторного засева идентификаторы изменятся, SQL для обновления указан в описании каждой
переменной.

## Безопасность

- **CORS** — только origin'ы из `CORS_ORIGINS` (никакого `*`), запросы с чужим origin отклоняются,
  preflight отвечает `204`. В `.env.example` разрешены локальные адреса фронтенда
  (`http://localhost:5173`, `http://localhost:3000`) — этого достаточно для локальной разработки.
- **Rate limiting** — на маршруты `/api`: `RATE_LIMIT_MAX` запросов за `RATE_LIMIT_WINDOW_MS`
  (по умолчанию 100 в минуту с одного IP). При превышении — `429` в общем формате ошибок,
  заголовки `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`.
- **Helmet** — защитные заголовки: `Content-Security-Policy`, `X-Frame-Options`,
  `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`;
  заголовок `X-Powered-By` скрыт.
- **Ограничение тела запроса** — 100 КБ (`express.json({ limit: '100kb' })`), превышение → `413`.
- **Токены** — вход выдаёт access-токен (JWT, 15 минут) в теле ответа и refresh-токен (7 дней)
  в cookie с флагами `HttpOnly`, `SameSite=Strict` и `Secure` в production-окружении.
  Access-токен проверяется на каждом защищённом маршруте, refresh — только эндпоинтом
  `POST /api/auth/refresh`, который выдаёт новую пару: старый refresh после ротации не действует.
- **Пароли** — хранятся только bcrypt-хешами (10 раундов, соль генерируется на каждый хеш);
  в ответах API и в логах пароли и хеши не появляются — pino маскирует `password`, `token`
  и заголовки `authorization` и `cookie`.
- **Ответ на неудачный вход** — одинаковый текст для неверного пароля и несуществующей почты,
  `requestId` в этом ответе не отдаётся: перебирать почты по разнице ответов нельзя.
- Секреты в репозитории отсутствуют: `.env` в `.gitignore`, есть `.env.example`. В ответах нет
  стек-трейсов и внутренних деталей — для ошибок 5xx текст заменяется общим сообщением.

## Правила пригодности окна для наружных работ

Эндпоинт `GET /api/equipment/:id/weather` берёт координаты оборудования, запрашивает прогноз
у Open-Meteo на 3 дня (`FORECAST_API_URL`, таймаут `REQUEST_TIMEOUT_MS`) и оценивает окно:

- окно пригодно, если **нет осадков** — сумма `precipitation_sum` за все дни окна не превышает
  `MAX_PRECIPITATION` (по умолчанию `0` мм);
- и **ветер ниже порога** — максимум `wind_speed_10m_max` за окно не превышает `MAX_WIND_SPEED`.

Единицы измерения — как их отдаёт Open-Meteo по умолчанию: температура `°C`, осадки `мм`,
ветер `км/ч` (то есть `MAX_WIND_SPEED=10` — это 10 км/ч). Если условия не выполнены, в ответе
`suitable: false` и заполненный массив `reasons` (`Сильный ветер`, `Осадки`).

Если внешний API недоступен или превышен таймаут, сервис не падает: возвращается `200`
с `suitable: null`, `reason` и `forecast.available: false` — клиент сам решает, показывать ли прогноз.

## Мониторинг

Метрики приложения собирает Prometheus, отображает Grafana; оба сервиса поднимаются вместе
со стеком через `docker compose up -d` (см. `compose.yaml`).

| Сервис | Адрес | Назначение |
|---|---|---|
| Prometheus | http://localhost:9090 | скрейпит `app:3000/metrics` каждые 15 с (`deploy/prometheus/prometheus.yml`); состояние целей — http://localhost:9090/targets |
| Grafana | http://localhost:3001 | логин `admin` / `admin`, дашборд «Equipment API» |

### Метрики

Приложение отдаёт метрики по пути `GET /metrics` — вне префикса `/api`, в текстовом формате
Prometheus. Наружу этот путь не публикуется: Prometheus обращается к нему по внутренней сети
compose, через nginx он не проксируется.

| Метрика | Тип | Метки | Что показывает |
|---|---|---|---|
| `http_requests_total` | counter | `method`, `route`, `status_code` | все запросы по маршрутам и статусам |
| `http_request_duration_seconds` | histogram | `method`, `route` | длительность запросов (p50/p95/p99) |
| `http_errors_total` | counter | `method`, `route`, `status_code` | ответы 4xx и 5xx |
| `maintenance_requests` | gauge | `status`, `priority` | заявки в БД по статусам и приоритетам |
| `maintenance_request_close_time_seconds` | gauge | — | среднее время закрытия заявки |
| `equipment_open_requests` | gauge | `equipment` | открытые заявки по единицам оборудования |
| `up` | gauge | `job` | доступность цели скрейпа |

Метка `route` — шаблон маршрута (`/api/equipment/:id`), поэтому число серий не растёт с числом
записей и идентификаторов. Запросы, отбитые до выбора маршрута (нет токена, невалидное тело),
подписываются префиксом ресурса (`/api/equipment`, `/api/auth`), несуществующие пути — `unmatched`.

Бизнес-метрики обновляются раз в 15 секунд из PostgreSQL (`src/lib/business-metrics.js`), время
закрытия считается по истории статусов (`request_status_history`), а не по `updatedAt`: правка
карточки заявки тоже меняет `updatedAt`, а запись о переходе в `done` остаётся одна.

### Дашборд

`deploy/grafana/provisioning/dashboards/equipment-api.json` — 9 панелей: технические (rate
запросов, доли 4xx и 5xx, p95 времени ответа, `up`) и прикладные (заявки по статусам, заявки
по приоритетам, среднее время закрытия, нагрузка на оборудование). Дашборд провижинится из
файла, поэтому правки в интерфейсе не сохраняются: меняйте JSON и перезапускайте Grafana.

### Алерт «Доля 5xx выше 5%»

Правило описано в `deploy/grafana/provisioning/alerting/5xx-share.yml`. Условие — PromQL
`sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) or vector(0)`
с порогом `> 0.05` (5%) и выдержкой `for: 5m`: состояние `Firing` наступает, если доля держится
выше порога 5 минут подряд, проверка идёт раз в минуту. `or vector(0)` нужен, чтобы при полном
отсутствии 5xx условие считалось нулём, а не «нет данных».

Порядок действий:

1. Посмотреть состояние: Grafana → **Alerting → Alert rules** → группа `equipment-api`, правило
   «Доля 5xx выше 5%». Там видны текущее состояние (`Normal` / `Pending` / `Firing`) и история
   переходов.
2. Проверить через API: `curl -u admin:admin http://localhost:3001/api/v1/provisioning/alert-rules`
   — список правил из файла; `curl -u admin:admin http://localhost:3001/api/prometheus/grafana/api/v1/rules`
   — текущее состояние (`state`, `health`, время последней проверки).
3. Убедиться, что алерт живой: панель «Доля 5xx» на дашборде → спровоцировать пятисотые
   (`docker compose stop db` и несколько запросов к API) → через 5 минут правило перейдёт в
   `Firing`; после `docker compose start db` и восстановления нормального трафика вернётся
   в `Normal`.
4. Изменить порог или выдержку: правки в `5xx-share.yml` (`params: [0.05]` — порог, `for: 5m` —
   выдержка), затем `docker compose restart grafana`.
5. Настроить уведомления: **Alerting → Contact points** — добавить получателя (почта, Telegram,
   webhook) и указать его в **Notification policies**. Это тоже можно описать файлом в
   `deploy/grafana/provisioning/alerting/`, если нужен полностью декларативный стек.

### Проверка стека

```bash
docker compose up -d --build         # собрать app и поднять nginx, app, db, prometheus, grafana
docker compose ps                    # сервисы healthy; наружу открыты 80, 443, 9090, 3001
curl http://localhost:9090/targets   # цель app:3000/metrics в состоянии UP
```

Дашборд и правило доступны сразу после старта: провижининг читает файлы из
`deploy/grafana/provisioning/` и `deploy/prometheus/prometheus.yml` при запуске контейнеров.

## Роли и права

Роль хранится в `users.role` и попадает в access-токен. Маршруты закрыты двумя middleware:
`authMiddleware` пропускает любого вошедшего, `requireRole(...)` — только перечисленные роли.

| Роль | Что может |
|---|---|
| `viewer` | Чтение справочников, заявок, истории и отчётов. Регистрация всегда создаёт эту роль |
| `technician` | Права viewer + создание и правка заявок, смена статуса заявок, в которые назначен |
| `admin` | Всё: управление оборудованием и площадками, назначение бригад, удаление записей |

Роль в теле `POST /api/auth/register` игнорируется: поднять её можно только со стороны базы,
поэтому самовольно стать администратором нельзя. Связь аккаунта со справочником техников лежит
в `users.technician_id` — по ней сервис проверяет, что специалист меняет статус только своей заявки.

## Тесты

```bash
docker compose up -d db_test    # отдельная тестовая база, публикуется как 127.0.0.1:5433
npm test                        # модульные + интеграционные тесты с отчётом о покрытии
npm run test:watch              # то же в режиме наблюдения
```

`npm test` — одна команда: `pretest` поднимает сервис `db_test` и ждёт его готовности, затем Jest
прогоняет наборы и печатает отчёт о покрытии; HTML-версия — в `coverage/lcov-report/index.html`.

| Набор | Что проверяет |
|---|---|
| `tests/unit/requestService.changeStatus.test.js` | разрешённые и запрещённые переходы статусов, история, права на смену |
| `tests/unit/requestService.assignTeam.test.js` | состав бригады: ровно один lead, дубли, несуществующие заявка и техник |
| `tests/unit/roleMiddleware.test.js` | `requireRole`: пропуск своих ролей, 403 чужим, опечатки в конфигурации |
| `tests/integration/auth.test.js` | регистрация, вход, refresh-cookie, хранение пароля хешем, конфликты, валидация |
| `tests/integration/access.test.js` | 401 без токена на всех защищённых путях, 403 при нехватке прав, битый токен |
| `tests/integration/equipment.test.js` | CRUD оборудования, 409 на дубликат serialNumber, мягкое удаление |
| `tests/integration/requests.test.js` | CRUD заявок, жизненный цикл статуса, правила бригады, история |
| `tests/integration/docs.test.js` | Swagger UI отвечает HTML, спецификация собирается из аннотаций роутов |

Тесты изолированы: модульные работают с подменёнными репозиториями (`jest.unstable_mockModule`),
интеграционные ходят в отдельную базу `equipment_api_test` через supertest, чистят за собой
между тестами и не обращаются к внешним HTTP-сервисам. Значимые для тестов переменные
(`PGDATABASE`, `PGPORT`, лимиты частоты) переопределяются в `tests/integration/helpers/test-context.js`.

## Эксплуатация

### Логи

Логи структурированные (pino) и идут в стандартный вывод; уровень задаётся переменной `LOG_LEVEL`.
В каждой записи есть уровень и `requestId`, а пароли, токены и заголовки `authorization` и `cookie`
маскируются.

```bash
docker compose logs -f app           # логи приложения
docker compose logs --tail 100 nginx
```

`requestId` возвращается в теле ошибки — по нему в логах находится вся история запроса.

### Типовые отказы

| Симптом | Где смотреть | Что делать |
|---|---|---|
| `/api/health/ready` отвечает 503, в теле `database: down` | `docker compose ps`, `docker compose logs db` | База недоступна: поднять контейнер `db`, проверить `PGHOST`, `PGPORT` и пароль в `.env` |
| Растёт доля 5xx | Дашборд «Equipment API», панель «Доля 5xx» и правило `Доля 5xx выше 5%` | Найти маршрут в метрике `http_errors_total`, затем записи с этим `requestId` в логах |
| Выросло время ответа p95 | Панель «Время ответа p95» | Посмотреть план запросов и индексы, проверить нагрузку на базу |
| Заканчивается место на диске | `docker system df` и размер томов | Очистить неиспользуемые образы (`docker image prune`), проверить размер `pgdata`, при необходимости перезапустить стек |
| Нужно откатить миграцию | — | `npx sequelize-cli db:migrate:undo` (одну) или `db:migrate:undo:all`: порядок в разделе «Откат миграций и сидов» |

Метрики отдаются на `GET /metrics` и собираются Prometheus каждые 15 секунд; дашборд и правило
алерта описаны файлами в `deploy/grafana/provisioning/` — см. раздел «Мониторинг».

## Принятые решения и ограничения

Как устроено:

- **Слоистость**: контроллер разбирает `req.valid` и формирует ответ, сервис держит правила,
  репозиторий — доступ к данным. Контроллеры не знают о Sequelize, сервисы — о Express.
- **Единый формат ответа**: `{ data }` и `{ data, meta }` для успеха, `{ error: { code, message,
  requestId, details? } }` для всех 4xx и 5xx — коды машинночитаемы, детали валидации приходят
  списком `{ field, message }`.
- **Смена статуса в транзакции**: строка заявки блокируется `SELECT ... FOR UPDATE`, переход
  проверяется по таблице допустимых, и только потом пишутся статус и запись в историю.
- **Мягкое удаление оборудования** (`paranoid`): строки остаются в базе, а частичный уникальный
  индекс позволяет занять освободившийся `serialNumber`.
- **Метка `route` в метриках — шаблон маршрута**, а не фактический путь: иначе число серий росло бы
  с каждым идентификатором.
- **Мониторинг декларативен**: источник данных, дашборд и правило алерта описаны файлами, при
  развёртывании с нуля настраивать Grafana руками не нужно.
- **Документация рядом с кодом**: спецификация OpenAPI собирается из `@openapi`-аннотаций в файлах
  роутов, поэтому описание не расходится с реализацией.

Ограничения:

- Nginx слушает 443 без сертификата: HTTPS с редиректом — из дополнительной части задания.
- Коллекция Postman описывает сценарии предметной области без шагов аутентификации, поэтому запросы
  к защищённым эндпоинтам нужно выполнять с заголовком `Authorization`.
- Интеграционные тесты требуют контейнера `db_test`: порты наружу он не публикует, том не хранит.
- Jest работает в режиме ESM (`--experimental-vm-modules`) и последовательно (`--runInBand`):
  проект на ESM, а наборы делят одну тестовую базу.
- Образы `prom/prometheus` и `grafana/grafana` закреплены на `:latest` — для воспроизводимости их
  стоит зафиксировать по версии.
- Swagger UI на `/api/docs` открыт без авторизации: токен вводится в нём кнопкой Authorize.

## Структура проекта

```text
case-2-equipment-api/
├── .env.example              # пример переменных окружения
├── .sequelizerc              # пути к конфигу, миграциям, сидам и моделям
├── compose.yaml              # стек: nginx, app, db, prometheus, grafana
├── deploy/                   # конфиги стека
│   ├── nginx/conf.d/app.conf # обратный прокси на app:3000
│   ├── prometheus/prometheus.yml  # скрейп app:3000/metrics каждые 15 с
│   └── grafana/provisioning/      # datasource, дашборд и правило алерта
├── package.json
├── README.md
└── src/
    ├── app.js                # сборка приложения: middleware → роутер → обработчики ошибок
    ├── server.js             # запуск HTTP-сервера и graceful shutdown
    ├── swagger.js            # сборка спецификации OpenAPI из аннотаций роутов
    ├── config/
    │   └── index.js          # чтение и проверка переменных окружения
    ├── controllers/          # HTTP-слой: разбор req.valid и формирование ответа
    │   ├── equipmentController.js
    │   ├── reportController.js
    │   ├── requestController.js
    │   └── siteController.js
    ├── db/                   # PostgreSQL: подключение, схема, данные
    │   ├── config.js         # конфиг для sequelize-cli и приложения
    │   ├── index.js          # экземпляр Sequelize из переменных PG*
    │   ├── migrations/       # 01-create-sites … 07-create-request-assignees
    │   ├── models/           # модели Sequelize и ассоциации (index.js)
    │   └── seeders/          # 01-sites … 07-history
    ├── errors/               # собственные типы ошибок
    │   ├── AppError.js
    │   ├── ConflictError.js
    │   ├── NotFoundError.js
    │   └── ValidationError.js
    ├── lib/                  # инфраструктура
    │   ├── logger.js         # pino (+ pino-pretty в development)
    │   ├── http-logger.js    # pino-http: requestId, уровень по статусу
    │   ├── context.js        # AsyncLocalStorage: reqId и логгер запроса
    │   ├── metrics.js        # метрики Prometheus и сбор HTTP-статистики
    │   └── business-metrics.js  # прикладные метрики из БД: заявки, загрузка
    ├── middlewares/          # validate, notFound, errorHandler
    ├── repositories/         # доступ к данным
    │   ├── BaseRepository.js
    │   ├── EquipmentRepository.js
    │   ├── ReportRepository.js      # отчёт по загрузке на подзапросах
    │   ├── reportsRepository.js     # вариант того же отчёта с bind-параметрами
    │   ├── RequestRepository.js
    │   ├── SiteRepository.js
    │   ├── TechnicianRepository.js
    │   └── index.js          # синглтоны репозиториев
    ├── routes/               # index, health, equipment, requests, sites, reports, metrics
    ├── services/             # бизнес-логика
    │   ├── equipmentService.js
    │   ├── reportService.js
    │   ├── requestService.js
    │   ├── siteService.js
    │   └── weatherService.js
    ├── utils/
    │   └── response.js       # sendList / sendOne — конверты ответов
    └── validators/           # zod-схемы body, query и params
        ├── equipmentSchemas.js
        ├── querySchemas.js
        ├── reportSchemas.js
        ├── requestSchemas.js
        └── siteSchemas.js
```
