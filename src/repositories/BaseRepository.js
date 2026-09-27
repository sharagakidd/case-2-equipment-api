import { Op, ForeignKeyConstraintError } from 'sequelize';
import { ConflictError } from '../errors/ConflictError.js';

export const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
// Второй ключ — чтобы порядок не плавал при одинаковом createdAt.
const DEFAULT_ORDER = [['createdAt', 'ASC'], ['id', 'ASC']];
const SYSTEM_FIELDS = ['id', 'createdAt', 'updatedAt'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Общая логика выборок в БД: наследники задают модель, поля сортировки и вид записей.
export class BaseRepository {
  constructor(model, { sortable = [], listInclude = [], detailInclude } = {}) {
    this.model = model;
    this.sortable = new Set(sortable);
    this.listInclude = listInclude;
    this.detailInclude = detailInclude ?? listInclude;
  }

  async findAll({ filters, sort, pagination } = {}) {
    const { rows, count } = await this.model.findAndCountAll({
      where: this.#buildWhere(filters),
      order: this.#buildOrder(sort),
      include: this.listInclude,
      // distinct: без него count размножится на связанных записях.
      distinct: true,
      ...this.#buildPagination(pagination),
    });

    return { data: rows.map((row) => this.toDomain(row)), total: count };
  }

  // Мусорный id не доводим до базы: она ответит ошибкой приведения типа.
  async findById(id, { transaction } = {}) {
    if (!isUuid(id)) return null;

    const row = await this.model.findByPk(id, { include: this.detailInclude, transaction });

    return this.toDomain(row);
  }

  // Блокировка строки: читаем только саму запись, без include —
  // PostgreSQL не принимает FOR UPDATE на внешней стороне LEFT JOIN.
  async findRowForUpdate(id, { transaction } = {}) {
    if (!isUuid(id)) return null;

    const row = await this.model.findByPk(id, { transaction, lock: transaction?.LOCK.UPDATE });

    return row ? row.get({ plain: true }) : null;
  }

  async create(data) {
    const row = await this.model.create(this.toColumns(data));

    return this.toDomain(row);
  }

  async update(id, data, { transaction } = {}) {
    if (!isUuid(id)) return null;

    const columns = this.toColumns(data);
    // Пустое обновление разрешено схемой: менять нечего — отдаём запись как есть.
    if (Object.keys(columns).length === 0) return this.findById(id, { transaction });

    const [affected] = await this.model.update(columns, { where: { id }, transaction });
    if (affected === 0) return null;

    return this.findById(id, { transaction });
  }

  async delete(id) {
    if (!isUuid(id)) return false;

    try {
      return (await this.model.destroy({ where: { id } })) > 0;
    } catch (error) {
      // Связанные строки держат запись: отдаём конфликт, а не ошибку сервера.
      if (isReferenceViolation(error)) throw new ConflictError(this.referencedMessage());
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

// PostgreSQL запрещает удаление родителя двумя кодами: 23503 (нарушение внешнего ключа) и
// 23001 (restrict_violation от ON DELETE RESTRICT). В ForeignKeyConstraintError Sequelize
// превращает только первый, поэтому второй распознаём по коду драйвера — иначе выйдет 500.
export function isReferenceViolation(error) {
  const code = error.parent?.code ?? error.original?.code;

  return error instanceof ForeignKeyConstraintError || code === '23503' || code === '23001';
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
