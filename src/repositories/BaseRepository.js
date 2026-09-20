import { randomUUID } from 'node:crypto';

// Базовый репозиторий в памяти: наследники описывают конкретную сущность, а CRUD,
// фильтрация, сортировка и пагинация живут здесь. Наружу отдаём копии объектов,
// чтобы данные нельзя было изменить в обход update() и не обновить updatedAt.
export class BaseRepository {
  constructor() {
    this.items = new Map();
  }

  // filters — точное совпадение по полям, массив в значении = «любое из»;
  // sort — { field, order } либо строка '-createdAt' (минус означает убывание);
  // pagination — { page, limit }. total считается до пагинации, без неё отдаём всё.
  findAll({ filters, sort, pagination } = {}) {
    let data = [...this.items.values()];

    if (filters) {
      const entries = Object.entries(filters).filter(([, value]) => value !== undefined);
      data = data.filter((item) =>
        entries.every(([field, value]) =>
          Array.isArray(value) ? value.includes(item[field]) : item[field] === value,
        ),
      );
    }

    if (sort) data = this.#applySort(data, sort);

    const total = data.length;

    return { data: this.#applyPagination(data, pagination).map((item) => ({ ...item })), total };
  }

  findById(id) {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  // id, createdAt и updatedAt проставляем после data: системные поля нельзя подменить.
  create(data) {
    const now = new Date().toISOString();
    const item = { ...data, id: randomUUID(), createdAt: now, updatedAt: now };

    this.items.set(item.id, item);

    return { ...item };
  }

  update(id, data) {
    const current = this.items.get(id);
    if (!current) return null;

    const updated = {
      ...current,
      ...data,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.items.set(id, updated);

    return { ...updated };
  }

  delete(id) {
    return this.items.delete(id);
  }

  exists(id) {
    return this.items.has(id);
  }

  #applySort(data, sort) {
    const { field, order = 'asc' } =
      typeof sort === 'string'
        ? { field: sort.replace(/^-/, ''), order: sort.startsWith('-') ? 'desc' : 'asc' }
        : sort;

    const direction = order === 'desc' ? -1 : 1;

    return [...data].sort((a, b) => {
      const left = a[field];
      const right = b[field];

      // Пустые значения всегда в конце — независимо от направления сортировки.
      if (left === right) return 0;
      if (left === undefined || left === null) return 1;
      if (right === undefined || right === null) return -1;

      return compareValues(left, right) * direction;
    });
  }

  #applyPagination(data, pagination) {
    if (!pagination) return data;

    const page = Math.max(1, Number(pagination.page) || 1);
    const limit = Math.max(1, Number(pagination.limit) || 20);
    const start = (page - 1) * limit;

    return data.slice(start, start + limit);
  }
}

// Строки сравниваем с учётом кириллицы, числа — арифметически.
function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;

  return String(a).localeCompare(String(b), 'ru');
}
