import { Op, ForeignKeyConstraintError } from 'sequelize';
import { ConflictError } from '../errors/ConflictError.js';

// Потолок размера страницы: защита от запросов вида ?limit=100000.
export const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
// Второй ключ нужен, чтобы порядок не «плавал» у записей с одинаковым createdAt.
const DEFAULT_ORDER = [['createdAt', 'ASC'], ['id', 'ASC']];
// Системные поля: их нельзя подменить через тело запроса.
const SYSTEM_FIELDS = ['id', 'createdAt', 'updatedAt'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Базовый репозиторий поверх Sequelize: фильтры, сортировка и разбивка на страницы
// выполняются в базе. Наследники задают модель, поля для сортировки и вид записей.
export class BaseRepository {
  constructor(model, { sortable = [], listInclude = [], detailInclude } = {}) {
    this.model = model;
    this.sortable = new Set(sortable);
    this.listInclude = listInclude;
    this.detailInclude = detailInclude ?? listInclude;
  }

  // Общее количество считаем без учёта страницы — в ответе оно по всей выборке.
  async findAll({ filters, sort, pagination } = {}) {
    const { rows, count } = await this.model.findAndCountAll({
      where: this.#buildWhere(filters),
      order: this.#buildOrder(sort),
      include: this.listInclude,
      // Считаем только уникальные строки: на связанных записях количество размножится.
      distinct: true,
      ...this.#buildPagination(pagination),
    });

    return { data: rows.map((row) => this.toDomain(row)), total: count };
  }

  // Мусорный id не доводим до базы: она ответит ошибкой приведения типа.
  async findById(id) {
    if (!isUuid(id)) return null;

    const row = await this.model.findByPk(id, { include: this.detailInclude });

    return this.toDomain(row);
  }

  async create(data) {
    const row = await this.model.create(this.toColumns(data));

    return this.toDomain(row);
  }

  async update(id, data) {
    if (!isUuid(id)) return null;

    const columns = this.toColumns(data);
    // Пустое обновление разрешено схемой: поля не трогаем, но метку времени обновляем.
    const values = Object.keys(columns).length > 0 ? columns : { updatedAt: new Date() };

    const [affected] = await this.model.update(values, { where: { id } });
    if (affected === 0) return null;

    // Возвращаем ту же форму, что findById: клиенту не важно, как меняли запись.
    return this.findById(id);
  }

  async delete(id) {
    if (!isUuid(id)) return false;

    try {
      return (await this.model.destroy({ where: { id } })) > 0;
    } catch (error) {
      // Связанные строки держат запись: отдаём конфликт, а не ошибку сервера.
      if (error instanceof ForeignKeyConstraintError) throw new ConflictError(this.referencedMessage());
      throw error;
    }
  }

  async exists(id) {
    if (!isUuid(id)) return false;

    return (await this.model.count({ where: { id } })) > 0;
  }

  // Поля из тела запроса → колонки таблицы. Неизвестные и системные отбрасываем.
  toColumns(data = {}) {
    const columns = {};

    for (const [field, value] of Object.entries(data)) {
      if (!SYSTEM_FIELDS.includes(field) && this.model.rawAttributes[field]) columns[field] = value;
    }

    return columns;
  }

  toDomain(row) {
    return row ? row.get({ plain: true }) : null;
  }

  referencedMessage() {
    return 'Нельзя удалить запись: на неё ссылаются другие данные';
  }

  #buildWhere(filters = {}) {
    const where = {};

    for (const [field, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;
      // Фильтр по несуществующему полю молча игнорируем вместо ошибки базы.
      if (!this.model.rawAttributes[field]) continue;

      where[field] = toOperator(value);
    }

    return where;
  }

  #buildOrder(sort) {
    if (!sort) return DEFAULT_ORDER;

    const { field, order } = parseSort(sort);
    // Белый список: неизвестное поле не сортируем, отдаём порядок по умолчанию.
    if (!this.sortable.has(field)) return DEFAULT_ORDER;

    return [[field, order === 'desc' ? 'DESC' : 'ASC']];
  }

  #buildPagination(pagination) {
    if (!pagination) return {};

    const limit = Math.min(Math.max(1, Number(pagination.limit) || DEFAULT_LIMIT), MAX_LIMIT);
    const page = Math.max(1, Number(pagination.page) || 1);

    return { limit, offset: (page - 1) * limit };
  }
}

// Значение фильтра: массив — «любое из», объект — диапазон, одно значение — совпадение.
function toOperator(value) {
  if (Array.isArray(value)) return { [Op.in]: value };

  if (isPlainObject(value)) {
    const range = {};
    if (value.gt !== undefined) range[Op.gt] = value.gt;
    if (value.gte !== undefined) range[Op.gte] = value.gte;
    if (value.lt !== undefined) range[Op.lt] = value.lt;
    if (value.lte !== undefined) range[Op.lte] = value.lte;

    if (Object.keys(range).length > 0) return range;
  }

  return value;
}

// Сортировка: строка вида «-createdAt» (минус — по убыванию) либо объект { field, order }.
function parseSort(sort) {
  if (typeof sort !== 'string') return { field: sort.field, order: sort.order ?? 'asc' };

  return { field: sort.replace(/^-/, ''), order: sort.startsWith('-') ? 'desc' : 'asc' };
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !(value instanceof Date);
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
