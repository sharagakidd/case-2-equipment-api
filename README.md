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
работает graceful shutdown: сервер перестаёт принимать соединения, ждёт завершения текущих запросов,
закрывает пул соединений с БД (в логе — `DB connections closed`) и выходит с кодом 0.

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
схема v2.1.0). Переменная `baseUrl` уже указывает на `http://localhost:3000/api` — это адрес
приложения при локальном запуске (`npm start`); если стек поднят в Docker, замените её на
`http://localhost/api` (запросы идут через nginx). Остальные значения заданы из сидов или
заполняются ответами предыдущих запросов.

| Папка | Что проверяет |
|---|---|
| `Auth` | `register` → `201`, `login` → `200` и сохранение `accessToken`, `refresh` → новый токен по HttpOnly-cookie |
| `Health` | доступность сервиса |
| `Equipment` | CRUD, список с фильтрами, заявки и прогноз по единице оборудования |
| `Requests` | создание, список, правка, смена статуса, удаление |
| `Negative` | `404`, `422`, `409`, `429` на некорректных данных |
| `Assignees` | назначение бригады → `201` и заголовок `Location`, два `lead` и вариант без `lead` → `422`, снятие исполнителя → `204` |
| `History` | история смены статуса заявки → `200` |
| `Sites` | сводка по площадке → `200` |
| `Reports` | отчёт по загрузке оборудования с параметром `siteId` и без него → `200` |
| `Negative Sequelize` | дубль серийного номера → `409`, ссылка на несуществующую площадку → `422` |

Аутентификация: перед защищёнными запросами выполните `Auth → Login` — скрипт запроса кладёт
`accessToken` в переменную коллекции, а на уровне коллекции настроен заголовок
`Authorization: Bearer {{accessToken}}`. Запросы папки `Auth` и `Health` помечены `No Auth`: они
публичные. Изменяющие операции требуют роли `technician` или `admin`, а регистрация создаёт `viewer`,
поэтому для записи поднимите роль SQL-командой (см. описание переменной `currentRole`) и войдите
заново. `Refresh` читает HttpOnly-cookie: она выставлена с флагом `Secure`, поэтому по
`http://localhost:3000` Postman её не отправит и ответ будет `401` — это ожидаемое поведение.

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
| `maintenance_requests_overdue` | gauge | — | просроченные плановые работы: `plannedAt` в прошлом и статус не `done`/`rejected` |
| `up` | gauge | `job` | доступность цели скрейпа |

Метка `route` — шаблон маршрута (`/api/equipment/:id`), поэтому число серий не растёт с числом
записей и идентификаторов. Запросы, отбитые до выбора маршрута (нет токена, невалидное тело),
подписываются префиксом ресурса (`/api/equipment`, `/api/auth`), несуществующие пути — `unmatched`.

Бизнес-метрики обновляются раз в 15 секунд из PostgreSQL (`src/lib/business-metrics.js`), время
закрытия считается по истории статусов (`request_status_history`), а не по `updatedAt`: правка
карточки заявки тоже меняет `updatedAt`, а запись о переходе в `done` остаётся одна.

### Дашборд

`deploy/grafana/provisioning/dashboards/equipment-api.json` — 10 панелей: технические (rate
запросов, доли 4xx и 5xx, p95 времени ответа, `up`) и прикладные (заявки по статусам, заявки
по приоритетам, среднее время закрытия, нагрузка на оборудование, просроченные плановые работы).
Дашборд провижинится из файла, поэтому правки в интерфейсе не сохраняются: меняйте JSON и
перезапускайте Grafana.

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
`authenticate` пропускает любого вошедшего, `requireRole(...)` — только перечисленные роли.

| Роль | Права |
|---|---|
| `viewer` | Чтение справочников, заявок, истории и отчётов |
| `technician` | Права viewer + создание и редактирование заявок, смена статуса заявок, на которые назначен |
| `admin` | Все операции: управление оборудованием, площадками и специалистами, назначение бригад, удаление записей |

Правила:

- любой аутентифицированный пользователь может читать данные (`GET /api/equipment`, `/api/requests`,
  `/api/sites/:id/summary`, `/api/reports/equipment-load`, `/api/requests/:id/history`);
- изменяющие операции требуют роли: заявки создаёт и правит `technician` или `admin`, а справочник
  оборудования, бригада и удаления — только `admin`;
- запрос без токена — `401 Unauthorized`, запрос с токеном без нужной роли — `403 Forbidden`;
- `technician` меняет статус только тех заявок, в которые назначен (связь аккаунта со справочником
  техников лежит в `users.technician_id`, назначения — в `request_assignees`), `admin` — любых;
- роль по умолчанию при регистрации — `viewer`: роль из тела `POST /api/auth/register` игнорируется,
  повысить её можно только со стороны базы.

## Запуск тестов

```bash
npm install                   # зависимости, включая dev (@jest/globals, supertest)
npm test                      # все наборы + отчёт о покрытии (скрипт уже включает --coverage)
npm test -- --coverage=false  # прогнать наборы без отчёта о покрытии
npm run test:watch            # те же наборы в режиме наблюдения
```

`npm test` — одна команда: `pretest` поднимает сервис `db_test` (`127.0.0.1:5433`) и ждёт готовности
базы, затем Jest прогоняет наборы последовательно (`--runInBand`; проект на ESM, поэтому нужен
`--experimental-vm-modules`) и печатает отчёт. HTML-версия покрытия — в `coverage/lcov-report/index.html`.

Что покрыто:

- **модульные тесты бизнес-логики** — переходы статусов заявок (`done` и `rejected` терминальные,
  смена запрещена без нужной роли), правила состава бригады (ровно один `lead`, дубли, несуществующие
  заявка и техник), `requireRole` (чужие роли → 403, опечатки в конфигурации ловятся на старте);
- **интеграционные тесты эндпоинтов** — аутентификация (регистрация, вход, refresh-cookie, хранение
  пароля хешем), CRUD оборудования и заявок, доступ без токена (`401`), доступ с недостаточными
  правами (`403`), конфликты (`409`: дубликат `serialNumber`, недопустимый переход статуса),
  валидация (`422`), документация `/api/docs` и метрика просроченных плановых работ.

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
| `tests/integration/overdue.test.js` | счётчик просроченных плановых работ и его выдача в `/metrics` |

Тесты изолированы и воспроизводимы: интеграционные ходят в отдельную базу `equipment_api_test` через
supertest, между тестами удаляют только свои данные (записи с префиксом `TEST-`, тестовые аккаунты) и не
обращаются к внешним HTTP-сервисам, поэтому повторный запуск даёт тот же результат. Модульные тесты
подменяют репозитории (`jest.unstable_mockModule`). Переменные для тестов (`PGDATABASE`, `PGPORT`,
лимиты частоты) переопределяются в `tests/integration/helpers/test-context.js`.

Отчёт о покрытии формируется в каталоге `coverage/`; на текущем наборе — **61,16% инструкций,
51,48% ветвей, 50,2% функций, 65,57% строк** (значения взяты из отчёта последнего прогона).

## Эксплуатация

### Где смотреть логи

```bash
docker compose logs -f app          # приложение: pino, JSON в stdout
docker compose logs -f nginx        # прокси: access и error
docker compose logs -f db           # PostgreSQL
docker compose logs -f grafana      # Grafana
docker compose logs -f prometheus   # Prometheus
docker compose logs --tail 100 app  # последние 100 строк без потока
```

Логи структурированные: JSON в stdout, уровень задаётся переменной `LOG_LEVEL` (в `development` —
человекочитаемый вывод через pino-pretty). В каждой записи есть `requestId`, и он совпадает с
`requestId` в теле ошибки API — по этому значению собирается история одного запроса. Поля `password`,
`token` и заголовки `authorization`, `cookie` в логи не попадают (маскируются).

Уровни pino числовые: `30` — info, `40` — warning (в том числе ответ 4xx), `50` — error (5xx):

```bash
docker compose logs app | grep '"level":50'     # ошибки приложения
docker compose logs app | grep '<requestId>'    # всё по одному запросу
```

### Где смотреть метрики

| Что | Адрес | Комментарий |
|---|---|---|
| Prometheus | http://localhost:9090 | состояние целей на `/targets`, сбор — каждые 15 с (`deploy/prometheus/prometheus.yml`) |
| Grafana | http://localhost:3001 | вход: `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` из `.env`, по умолчанию `admin`/`admin` |
| Метрики приложения | `GET /metrics` | формат Prometheus; наружу не публикуется: nginx проксирует только `/api/` и `/health`, Prometheus обращается к `app:3000` по внутренней сети compose |

Дашборд «Equipment API», источник данных и правило алерта подключаются автоматически при старте
Grafana (`deploy/grafana/provisioning/`) — настраивать вручную ничего не нужно. Панели:

- технические: запросы в секунду, доля 4xx, доля 5xx, время ответа p95, доступность цели (`up`);
- прикладные: заявки по статусам, заявки по приоритетам, среднее время закрытия, нагрузка на
  оборудование (открытые заявки) и просроченные плановые работы.

### Порядок действий при типовых отказах

**1. Приложение не отвечает, `/api/health/ready` возвращает 503** (в теле `database: down`).

- `docker compose ps` — какой сервис не в состоянии `healthy`;
- `docker compose logs app` — ошибки подключения к БД (`ECONNREFUSED`, таймауты пула);
- `docker compose logs db` — запустилась ли база, нет ли ошибок инициализации;
- действие: `docker compose restart db`, дождаться `healthy`, затем `docker compose restart app`.

**2. Растёт доля ответов 5xx** (панель «Доля 5xx», правило алерта «Доля 5xx выше 5%»).

- открыть Grafana → панель «Доля 5xx», найти маршрут в метрике `http_errors_total`;
- `docker compose logs app | grep '"level":50'` — текст ошибки и `requestId`;
- сопоставить `requestId` с логами Nginx: `docker compose logs nginx | grep <requestId>`;
- типовые причины: недоступна БД, ошибка в коде, исчерпан пул соединений.

**3. Заканчивается место на диске.**

- `df -h` (в WSL/Linux) и `docker system df` — сколько заняли образы, тома и кеш сборки;
- `docker volume ls` — тома `pgdata`, `prometheus_data`, `grafana_data`;
- очистка: `docker system prune -a --volumes` — **осторожно**: удалит неиспользуемые тома, данные
  Grafana и Prometheus из них не восстанавливаются;
- старые метрики удаляются вместе с томом `prometheus_data`; срок хранения Prometheus задаётся флагом
  `--storage.tsdb.retention.time` (по умолчанию 15 дней, в `compose.yaml` флаг не выставлен).

**4. Нужно откатить миграцию.**

- `npx sequelize-cli db:migrate:undo` — откатить последнюю применённую миграцию;
- `npx sequelize-cli db:migrate:undo:all` — откатить всю схему до пустой базы;
- порядок и сиды — в разделе «Запуск → Откат миграций и сидов». Миграции применяются отдельной
  командой и в старт контейнера не встроены, поэтому откат не ломает запуск приложения.


## Архитектурные решения и ограничения

### Слои приложения

| Слой | Ответственность |
|---|---|
| `src/routes` | принимает HTTP-запрос, навешивает middleware (аутентификация, роли, валидация), отдаёт ответ |
| `src/controllers` | разбирает `req.valid`, вызывает сервис, формирует тело ответа |
| `src/services` | бизнес-логика: правила переходов статусов, состав бригады, транзакции |
| `src/repositories` | доступ к данным через Sequelize, единый вид сущностей для API |

Правило границ: репозиторий ничего не знает про HTTP, роут — про SQL. Проверка прав вынесена на
уровень роутов (`authenticate` + `requireRole`), правила предметной области живут в сервисах.

Формат ответов единый: `{ data }` и `{ data, meta }` для успеха, `{ error: { code, message,
requestId, details? } }` для всех 4xx и 5xx — коды машинночитаемы, детали валидации приходят
списком `{ field, message }`. Смена статуса идёт в транзакции: строка заявки блокируется
`SELECT ... FOR UPDATE`, переход проверяется по таблице допустимых, затем пишутся статус и история.
Оборудование удаляется мягко (`paranoid`), а частичный уникальный индекс позволяет занять
освободившийся `serialNumber`.

### Аутентификация

- **Access-токен** — JWT на 15 минут (`ACCESS_TOKEN_TTL`) в заголовке `Authorization: Bearer <token>`;
  содержит `sub`, `email` и `role`, поэтому проверка роли не требует похода в базу.
- **Refresh-токен** — JWT на 7 дней (`REFRESH_TOKEN_TTL`) в HttpOnly-cookie с флагами `HttpOnly`,
  `Secure`, `SameSite=Strict` и путём `/api/auth`. `SameSite=Strict` защищает от CSRF (cookie не уходит
  с чужих сайтов), `HttpOnly` — от кражи токена через XSS (JS его не читает), `Secure` — от отправки
  по незашифрованному каналу.
- **Ротация**: `POST /api/auth/refresh` выдаёт новую пару, старый refresh перестаёт действовать;
  пользователь перечитывается из базы, поэтому понижение роли или удаление аккаунта лишает доступа.
- **Пароли** — bcrypt, cost 10, соль генерируется на каждый хеш; хеш не покидает сервисный слой, в
  ответах и логах его нет. Ответ на неверный пароль и на несуществующую почту одинаков.

### Развёртывание

- Один `compose.yaml` и одна команда: `docker compose up -d --build` (nginx, app, db, prometheus, grafana).
- Снаружи опубликован только Nginx (80 и 443). Порты приложения и БД наружу не смотрят: `db` слушает
  `127.0.0.1:5432` только для миграций с хоста, `app` доступен лишь по внутренней сети compose.
- Образ приложения собирается в два этапа (`Dockerfile`): сначала `build` со всеми зависимостями,
  затем финальный слой с `npm ci --omit=dev` — dev-зависимости в него не попадают; процесс работает
  под непривилегированным пользователем `node`, а `init: true` даёт корректную обработку сигналов.
- Данные лежат в томах: `pgdata` (PostgreSQL), `grafana_data`, `prometheus_data`.
- Завершение по `SIGTERM`/`SIGINT`: сервер перестаёт принимать соединения, ждёт текущие запросы,
  закрывает пул Sequelize (в логе `DB connections closed`) и выходит с кодом 0.

### Мониторинг

- Приложение отдаёт метрики `prom-client` на `GET /metrics`: счётчики запросов и ошибок, гистограмма
  длительности, прикладные показатели из БД и стандартные метрики процесса Node.
- Prometheus скрейпит `app:3000/metrics` каждые 15 секунд; Grafana поднимается в том же стеке, а
  источник данных, дашборд и правило алерта подключаются через provisioning
  (`deploy/grafana/provisioning/`) — при развёртывании с нуля настраивать Grafana руками не нужно.
- Прикладные метрики обновляются опросом БД раз в 15 секунд (`startBusinessMetrics`), а не на каждом
  запросе: `/metrics` не создаёт дополнительную нагрузку.
- Метка `route` в HTTP-метриках — шаблон маршрута, а не фактический путь: иначе число серий росло бы
  с каждым идентификатором.

### Nginx

- Реверс-прокси: конфиг `deploy/nginx/conf.d/app.conf`, наружу отдаются `/api/` и `/health`
  (проверка самого прокси), остальное — 404.
- Пробрасываются `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`; таймауты соединения и
  чтения — 5/30/30 секунд.
- В Express включено `app.set('trust proxy', 1)`: без этого лимиты частоты и логи видели бы адрес
  nginx, а не клиента.

### Известные ограничения

- **TLS не настроен**: Nginx слушает 443, но сертификата нет, трафик идёт по HTTP; в продакшене нужен
  TLS-терминатор и редирект с 80 на 443.
- **Нет горизонтального масштабирования**: один экземпляр приложения, без балансировки и реплик БД.
- **Refresh-токены не отзываются**: чёрного списка нет (в стеке нет Redis), `logout` только удаляет
  cookie на клиенте — уже выданный refresh доживёт до конца срока (7 дней).
- **Миграции применяются вручную** отдельной командой и не встроены в старт контейнера.
- **Мониторинг не покрывает внутреннее состояние БД**: размер таблиц, медленные запросы и блокировки
  нигде не собираются (нужен postgres_exporter).
- **Rate limit хранится в памяти процесса** (`express-rate-limit`): при нескольких экземплярах лимит
  считается отдельно на каждом, общий счётчик потребовал бы Redis.

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
