import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';

const routesPath = join(dirname(fileURLToPath(import.meta.url)), 'routes', '*.js').replace(/\\/g, '/');

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Equipment API',
    version: '1.0.0',
    description: [
      'API учёта заявок на обслуживание оборудования: справочник техники, заявки,',
      'переходы статусов, бригады, отчёты и мониторинг.',
      '',
      '**Аутентификация.** Вход возвращает access-токен (15 минут) в теле ответа и',
      'refresh-токен в HttpOnly-cookie. Защищённые эндпоинты ждут заголовок',
      '`Authorization: Bearer <accessToken>`; в Swagger UI токен подставляется',
      'кнопкой **Authorize**.',
      '',
      '**Единый формат ошибки.** Любой ответ 4xx и 5xx выглядит так:',
      '`{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }` —',
      'поле `details` приходит только у ошибок валидации.',
    ].join('\n'),
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Auth', description: 'Регистрация, вход и перевыпуск токенов' },
    { name: 'Equipment', description: 'Справочник оборудования' },
    { name: 'Requests', description: 'Заявки на обслуживание' },
    { name: 'Sites', description: 'Площадки' },
    { name: 'Reports', description: 'Отчёты' },
    { name: 'Service', description: 'Служебные эндпоинты: health и метрики' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access-токен из ответа POST /api/auth/login, действует 15 минут.',
      },
    },
    parameters: {
      Page: {
        name: 'page',
        in: 'query',
        description: 'Номер страницы',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        description: 'Размер страницы (1–100)',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      SortBy: {
        name: 'sortBy',
        in: 'query',
        description: 'Поле сортировки, например name или createdAt',
        schema: { type: 'string' },
      },
      Order: {
        name: 'order',
        in: 'query',
        description: 'Направление сортировки',
        schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
      },
      IdParam: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Идентификатор (UUID v4)',
        schema: { type: 'string', format: 'uuid' },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Access-токен не передан (или заголовок не Bearer)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Forbidden: {
        description: 'Токен недействителен или у роли нет прав на операцию',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      ValidationError: {
        description: 'Ошибка валидации body, query или параметров пути',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      NotFound: {
        description: 'Запись не найдена',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Conflict: {
        description: 'Конфликт данных: дубликат, запрещённый переход статуса или связанные записи',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      ServerError: {
        description: 'Внутренняя ошибка сервера',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        description: 'Единый формат ошибки для всех ответов 4xx и 5xx',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                description: 'Машинный код ошибки',
                enum: [
                  'VALIDATION_ERROR',
                  'UNAUTHORIZED',
                  'FORBIDDEN',
                  'INVALID_CREDENTIALS',
                  'NOT_FOUND',
                  'CONFLICT',
                  'RATE_LIMIT_EXCEEDED',
                  'INTERNAL_ERROR',
                ],
              },
              message: {
                type: 'string',
                description: 'Текст ошибки для человека',
                example: 'Заявка не найдена',
              },
              requestId: {
                type: 'string',
                description: 'Идентификатор запроса для поиска в логах',
                example: '3f1c9a2e-7c2b-4d5f-9a1e-2b6c8d4e0f11',
              },
              details: {
                type: 'array',
                description: 'Список проблем, приходит у VALIDATION_ERROR',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string', example: 'password' },
                    message: {
                      type: 'string',
                      example: 'Пароль должен быть не короче 8 символов',
                    },
                  },
                },
              },
            },
          },
        },
      },
      Equipment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          siteId: { type: 'string', format: 'uuid', nullable: true },
          name: { type: 'string', example: 'Ветротурбина №1' },
          type: { type: 'string', enum: ['turbine', 'inverter', 'sensor', 'substation'] },
          serialNumber: { type: 'string', example: 'WT-1001' },
          status: {
            type: 'string',
            enum: ['operational', 'maintenance', 'fault', 'decommissioned'],
          },
          installedAt: { type: 'string', format: 'date-time', nullable: true },
          lat: { type: 'number', nullable: true, example: 55.7558 },
          lon: { type: 'number', nullable: true, example: 37.6173 },
        },
      },
      EquipmentInput: {
        type: 'object',
        required: ['name', 'type', 'serialNumber', 'location'],
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 100, example: 'Ветротурбина №5' },
          type: { type: 'string', enum: ['turbine', 'inverter', 'sensor', 'substation'] },
          serialNumber: { type: 'string', minLength: 1, example: 'WT-5005' },
          location: {
            type: 'object',
            required: ['lat', 'lon'],
            properties: {
              lat: { type: 'number', minimum: -90, maximum: 90, example: 55.7558 },
              lon: { type: 'number', minimum: -180, maximum: 180, example: 37.6173 },
            },
          },
          status: {
            type: 'string',
            enum: ['operational', 'maintenance', 'fault', 'decommissioned'],
            default: 'operational',
          },
          siteId: { type: 'string', format: 'uuid', nullable: true },
          installedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Дата установки, не может быть в будущем',
          },
        },
      },
      MaintenanceRequest: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          equipmentId: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Замена подшипника' },
          description: { type: 'string', nullable: true },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          status: { type: 'string', enum: ['new', 'in_progress', 'done', 'rejected'] },
          plannedAt: { type: 'string', format: 'date-time', nullable: true },
          author: { type: 'string', nullable: true, example: 'tech@example.com' },
        },
      },
      RequestInput: {
        type: 'object',
        required: ['equipmentId', 'title'],
        properties: {
          equipmentId: { type: 'string', format: 'uuid' },
          title: { type: 'string', minLength: 5, maxLength: 120, example: 'Замена подшипника' },
          description: { type: 'string', maxLength: 2000 },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
          },
          plannedAt: { type: 'string', format: 'date-time' },
        },
      },
      Assignee: {
        type: 'object',
        required: ['technicianId', 'role'],
        properties: {
          technicianId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ['lead', 'member'] },
          hours: { type: 'number', minimum: 0, maximum: 9999.99, nullable: true },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          total: { type: 'integer', example: 42 },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          totalPages: { type: 'integer', example: 3 },
        },
      },
      EquipmentResponse: {
        type: 'object',
        properties: { data: { $ref: '#/components/schemas/Equipment' } },
      },
      RequestResponse: {
        type: 'object',
        properties: { data: { $ref: '#/components/schemas/MaintenanceRequest' } },
      },
      EquipmentListResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Equipment' } },
          meta: { $ref: '#/components/schemas/PaginationMeta' },
        },
      },
      RequestListResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/MaintenanceRequest' } },
          meta: { $ref: '#/components/schemas/PaginationMeta' },
        },
      },
      UserResponse: {
        type: 'object',
        properties: { data: { $ref: '#/components/schemas/User' } },
      },
      AuthResponse: {
        type: 'object',
        description: 'Access-токен в теле, refresh-токен приходит в HttpOnly-cookie',
        properties: {
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              accessToken: { type: 'string', description: 'JWT на 15 минут' },
            },
          },
        },
      },
      HealthStatus: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'], example: 'ok' },
          database: { type: 'string', enum: ['up', 'down'], example: 'up' },
        },
      },
      Credentials: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@example.com' },
          password: {
            type: 'string',
            format: 'password',
            minLength: 8,
            maxLength: 72,
            example: 'Passw0rd!2345',
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['viewer', 'technician', 'admin'] },
          technicianId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

export const swaggerSpec = swaggerJsdoc({ definition, apis: [routesPath] });

export default swaggerSpec;
