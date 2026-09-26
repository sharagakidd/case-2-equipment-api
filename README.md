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

## Запуск

```bash
npm run dev     # nodemon: перезапуск при изменении файлов
npm start       # обычный запуск
```

Сервер слушает `http://localhost:3000`, базовый путь API — `/api`. При остановке (Ctrl+C, SIGTERM)
работает graceful shutdown: сервер перестаёт принимать соединения, ждёт завершения текущих
и только затем выходит.

## Модель данных

### Equipment (оборудование)

| Поле | Тип | Правила |
|---|---|---|
| `id` | string | UUID, генерируется сервером |
| `name` | string | 3–100 символов, обязательное |
| `type` | string | `turbine` \| `inverter` \| `sensor` \| `substation` |
| `serialNumber` | string | непустой, уникальный в пределах системы |
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

## Эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/health` | проверка доступности сервиса (в логи не пишется) |
| GET | `/api/equipment` | список оборудования: фильтры, сортировка, пагинация |
| POST | `/api/equipment` | создание единицы оборудования |
| GET | `/api/equipment/:id` | карточка оборудования |
| PATCH | `/api/equipment/:id` | частичное обновление |
| DELETE | `/api/equipment/:id` | удаление (запрещено при наличии открытых заявок) |
| GET | `/api/equipment/:id/requests` | заявки по конкретной единице оборудования |
| GET | `/api/equipment/:id/weather` | прогноз по координатам объекта и пригодность окна для работ |
| GET | `/api/requests` | список заявок: фильтры, сортировка, пагинация |
| POST | `/api/requests` | создание заявки |
| GET | `/api/requests/:id` | карточка заявки |
| PATCH | `/api/requests/:id` | редактирование полей заявки (статус этим методом не меняется) |
| PATCH | `/api/requests/:id/status` | смена статуса с проверкой допустимости перехода |
| DELETE | `/api/requests/:id` | удаление заявки |

Формат ответов: одиночная сущность — `{ "data": { … } }`, список — `{ "data": [ … ], "meta": { "total": n, "page": 1, "limit": 20, "totalPages": m } }`.
Создание возвращает `201` и заголовок `Location` с адресом новой сущности, удаление — `204` без тела.

Параметры списков (все необязательные, кроме значений по умолчанию):

| Эндпоинт | Поддерживаемые параметры запроса |
|---|---|
| `GET /api/equipment` | `page` (по умолчанию 1), `limit` (20, максимум 100), `status`, `type`, `sortBy`, `order` (`asc`/`desc`) |
| `GET /api/requests` | `page`, `limit`, `status`, `priority`, `equipmentId`, `sortBy`, `order` |
| `GET /api/equipment/:id/requests` | `page`, `limit`, `status`, `priority`, `sortBy`, `order` |

`sortBy` принимает имя поля сущности, для убывания используйте `order=desc`. Некорректные значения
этих параметров дают `422`; неизвестные параметры просто игнорируются.

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
- **Cookie не используются**, поэтому флаги `SameSite`, `HttpOnly` и `Secure` не применимы:
  сервис не ставит cookie и не хранит сессий (CORS настроен с `credentials: true`, но
  аутентификация в текущей версии отсутствует).
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

## Структура проекта

```text
case-2-equipment-api/
├── .env.example              # пример переменных окружения
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── src/
    ├── app.js                # сборка приложения: middleware → роутер → обработчики ошибок
    ├── server.js             # запуск HTTP-сервера и graceful shutdown
    ├── config/
    │   └── index.js          # чтение и проверка переменных окружения
    ├── controllers/          # HTTP-слой: разбор req.valid и формирование ответа
    │   ├── equipmentController.js
    │   └── requestController.js
    ├── errors/               # собственные типы ошибок
    │   ├── AppError.js
    │   ├── NotFoundError.js
    │   ├── ConflictError.js
    │   └── ValidationError.js
    ├── lib/                  # инфраструктура
    │   ├── logger.js         # pino (+ pino-pretty в development)
    │   ├── http-logger.js    # pino-http: requestId, уровень по статусу
    │   └── context.js        # AsyncLocalStorage: reqId и логгер запроса
    ├── middlewares/          # validate, notFound, errorHandler
    ├── repositories/         # доступ к данным
    │   ├── BaseRepository.js
    │   ├── EquipmentRepository.js
    │   ├── RequestRepository.js
    │   └── index.js          # синглтоны репозиториев
    ├── routes/               # index, health, equipment, requests
    ├── services/             # бизнес-логика
    │   ├── equipmentService.js
    │   ├── requestService.js
    │   └── weatherService.js
    ├── utils/
    │   └── response.js       # sendList / sendOne — конверты ответов
    └── validators/           # zod-схемы body, query и params
        ├── equipmentSchemas.js
        ├── requestSchemas.js
        └── querySchemas.js
```
