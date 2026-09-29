import { jest } from '@jest/globals';
import { ForbiddenError } from '../../src/errors/ForbiddenError.js';

jest.unstable_mockModule('../../src/db/models/user.js', () => ({
  USER_ROLES: ['viewer', 'technician', 'admin'],
}));

const { requireRole } = await import('../../src/middlewares/roleMiddleware.js');

const res = {};
let next;

beforeEach(() => {
  next = jest.fn();
});

describe('requireRole: пропуск разрешённых ролей', () => {
  test('роль из списка пропускается без ошибки', () => {
    requireRole('admin')({ user: { role: 'admin' } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  test.each(['admin', 'technician'])('роль %s проходит там, где разрешены обе', (role) => {
    requireRole('admin', 'technician')({ user: { role } }, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireRole: отказ', () => {
  test('чужая роль → ForbiddenError со списком допустимых', () => {
    requireRole('admin')({ user: { role: 'viewer' } }, res, next);

    const [error] = next.mock.calls[0];
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.status).toBe(403);
    expect(error.message).toMatch(/требуется роль admin/);
  });

  test('viewer не проходит туда, где нужны admin или technician', () => {
    requireRole('admin', 'technician')({ user: { role: 'viewer' } }, res, next);

    const [error] = next.mock.calls[0];
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toMatch(/admin или technician/);
  });

  test('technician не проходит на админский маршрут', () => {
    requireRole('admin')({ user: { role: 'technician' } }, res, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
  });

  test('нет req.user (authenticate не подключён) → отказ, а не пропуск', () => {
    requireRole('admin')({}, res, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
  });

  test('роль отсутствует в req.user → отказ', () => {
    requireRole('admin')({ user: {} }, res, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
  });
});

describe('requireRole: опечатки в конфигурации ловятся на старте', () => {
  test('без ролей выбрасывается ошибка', () => {
    expect(() => requireRole()).toThrow(/не передано ни одной роли/);
  });

  test('неизвестная роль выбрасывается ошибка со списком', () => {
    expect(() => requireRole('superadmin')).toThrow(/неизвестные роли: superadmin/);
  });

  test('сначала проверяются все роли, middleware не создаётся', () => {
    expect(() => requireRole('admin', 'root')).toThrow(/неизвестные роли: root/);
  });
});
