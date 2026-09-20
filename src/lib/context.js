import { AsyncLocalStorage } from 'node:async_hooks';
import logger from './logger.js';

// Контекст запроса: в store кладём reqId и логгер конкретного запроса, чтобы
// из любого места ниже по стеку (сервис, репозиторий) можно было достать их
// через getLog(), не протаскивая req параметром через все функции.
export const store = new AsyncLocalStorage();

export function contextMiddleware(req, res, next) {
  store.run({ reqId: req.id, log: req.log }, next);
}

export function getLog() {
  return store.getStore()?.log ?? logger;
}
