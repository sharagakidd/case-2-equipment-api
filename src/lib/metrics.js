import client from 'prom-client';

export const register = new client.Registry();

register.setDefaultLabels({ app: 'equipment-api' });
client.collectDefaultMetrics({ register });

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Всего HTTP-запросов',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Длительность HTTP-запроса в секундах',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'HTTP-ответы со статусом 4xx или 5xx',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// route — шаблон маршрута, а не фактический путь: иначе серия растёт с каждым id.
// Отбитые до выбора маршрута запросы подписываем ресурсом из списка ниже.
const API_RESOURCES = new Set(['health', 'equipment', 'requests', 'sites', 'reports', 'auth']);

function resourcePrefix(originalUrl) {
  const [first, second] = String(originalUrl ?? '')
    .split('?')[0]
    .split('/')
    .filter(Boolean);

  if (first === 'metrics') {
    return '/metrics';
  }

  return first === 'api' && API_RESOURCES.has(second) ? `/api/${second}` : null;
}

function routeLabel(req) {
  if (req.route) {
    const base = req.baseUrl ?? '';
    const path = req.route.path === '/' ? '' : req.route.path;

    return `${base}${path}` || '/';
  }

  return resourcePrefix(req.originalUrl) ?? 'unmatched';
}

export function httpMetricsMiddleware(req, res, next) {
  const stopTimer = httpRequestDurationSeconds.startTimer({ method: req.method });

  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }

    stopTimer({ route: labels.route });
  });

  next();
}

export async function metricsHandler(req, res, next) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    next(error);
  }
}
