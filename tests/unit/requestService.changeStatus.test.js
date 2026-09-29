import { jest } from '@jest/globals';
import { ConflictError } from '../../src/errors/ConflictError.js';
import { ForbiddenError } from '../../src/errors/ForbiddenError.js';
import { NotFoundError } from '../../src/errors/NotFoundError.js';

const requestRepository = {
  findRowForUpdate: jest.fn(),
  countAssignees: jest.fn(),
  isAssignee: jest.fn(),
  update: jest.fn(),
  addStatusHistory: jest.fn(),
  findById: jest.fn(),
};

const userRepository = { findById: jest.fn() };

jest.unstable_mockModule('../../src/repositories/index.js', () => ({
  requestRepository,
  userRepository,
  equipmentRepository: {},
  technicianRepository: {},
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  sequelize: { transaction: (callback) => callback({ id: 'tx' }) },
}));

const { requestService } = await import('../../src/services/requestService.js');

const ADMIN = { userId: 'user-admin', role: 'admin' };
const TECHNICIAN = { userId: 'user-tech', role: 'technician' };
const VIEWER = { userId: 'user-viewer', role: 'viewer' };
const TX = { transaction: { id: 'tx' } };

const rowWithStatus = (status) => ({ id: 'req-1', status });

beforeEach(() => {
  jest.clearAllMocks();
  requestRepository.findRowForUpdate.mockResolvedValue(rowWithStatus('new'));
  requestRepository.countAssignees.mockResolvedValue(1);
  requestRepository.isAssignee.mockResolvedValue(true);
  requestRepository.update.mockResolvedValue(1);
  requestRepository.addStatusHistory.mockResolvedValue({});
  requestRepository.findById.mockResolvedValue({ id: 'req-1', status: 'done' });
  userRepository.findById.mockResolvedValue({
    id: 'user-admin',
    email: 'admin@example.com',
    role: 'admin',
    technicianId: null,
  });
});

describe('changeStatus: разрешённые переходы', () => {
  test.each([
    ['new', 'in_progress'],
    ['new', 'rejected'],
    ['in_progress', 'done'],
    ['in_progress', 'rejected'],
  ])('%s → %s проходит и попадает в историю', async (from, to) => {
    requestRepository.findRowForUpdate.mockResolvedValue(rowWithStatus(from));

    await requestService.changeStatus('req-1', to, { user: ADMIN });

    expect(requestRepository.update).toHaveBeenCalledWith('req-1', { status: to }, TX);
    expect(requestRepository.addStatusHistory).toHaveBeenCalledWith(
      { requestId: 'req-1', oldStatus: from, newStatus: to, author: 'admin@example.com' },
      TX,
    );
  });

  test('возвращается обновлённая заявка', async () => {
    const updated = { id: 'req-1', status: 'rejected' };
    requestRepository.findById.mockResolvedValue(updated);

    await expect(requestService.changeStatus('req-1', 'rejected', { user: ADMIN })).resolves.toBe(updated);
  });
});

describe('changeStatus: запрещённые переходы', () => {
  test.each([
    ['new', 'done'],
    ['in_progress', 'new'],
    ['done', 'in_progress'],
    ['done', 'rejected'],
    ['rejected', 'new'],
    ['rejected', 'in_progress'],
  ])('%s → %s отклоняется с ConflictError, запись не меняется', async (from, to) => {
    requestRepository.findRowForUpdate.mockResolvedValue(rowWithStatus(from));

    await expect(requestService.changeStatus('req-1', to, { user: ADMIN })).rejects.toBeInstanceOf(ConflictError);

    expect(requestRepository.update).not.toHaveBeenCalled();
    expect(requestRepository.addStatusHistory).not.toHaveBeenCalled();
  });

  test('статус вне справочника отклоняется', async () => {
    await expect(requestService.changeStatus('req-1', 'closed', { user: ADMIN })).rejects.toBeInstanceOf(ConflictError);
  });

  test('new → in_progress без исполнителей отклоняется', async () => {
    requestRepository.countAssignees.mockResolvedValue(0);

    await expect(requestService.changeStatus('req-1', 'in_progress', { user: ADMIN })).rejects.toThrow(
      /без назначенных исполнителей/,
    );
    expect(requestRepository.update).not.toHaveBeenCalled();
  });

  test('несуществующая заявка → NotFoundError', async () => {
    requestRepository.findRowForUpdate.mockResolvedValue(null);

    await expect(requestService.changeStatus('req-1', 'in_progress', { user: ADMIN })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('changeStatus: права на смену статуса', () => {
  test('admin меняет статус любой заявки, назначение не проверяется', async () => {
    requestRepository.findRowForUpdate.mockResolvedValue(rowWithStatus('in_progress'));

    await requestService.changeStatus('req-1', 'done', { user: ADMIN });

    expect(requestRepository.isAssignee).not.toHaveBeenCalled();
    expect(requestRepository.update).toHaveBeenCalled();
  });

  test('technician из бригады меняет статус, автором становится его почта', async () => {
    requestRepository.findRowForUpdate.mockResolvedValue(rowWithStatus('in_progress'));
    userRepository.findById.mockResolvedValue({ id: 'user-tech', email: 'tech@example.com', technicianId: 'tech-1' });

    await requestService.changeStatus('req-1', 'done', { user: TECHNICIAN });

    expect(requestRepository.isAssignee).toHaveBeenCalledWith('req-1', 'tech-1', TX);
    expect(requestRepository.addStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ author: 'tech@example.com' }),
      TX,
    );
  });

  test('technician не из бригады получает ForbiddenError', async () => {
    requestRepository.findRowForUpdate.mockResolvedValue(rowWithStatus('in_progress'));
    userRepository.findById.mockResolvedValue({ id: 'user-tech', technicianId: 'tech-9' });
    requestRepository.isAssignee.mockResolvedValue(false);

    await expect(requestService.changeStatus('req-1', 'done', { user: TECHNICIAN })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(requestRepository.update).not.toHaveBeenCalled();
  });

  test('technician без связи со справочником получает ForbiddenError', async () => {
    requestRepository.findRowForUpdate.mockResolvedValue(rowWithStatus('in_progress'));
    userRepository.findById.mockResolvedValue({ id: 'user-tech', technicianId: null });

    await expect(requestService.changeStatus('req-1', 'done', { user: TECHNICIAN })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(requestRepository.isAssignee).not.toHaveBeenCalled();
  });

  test('viewer не может менять статус', async () => {
    requestRepository.findRowForUpdate.mockResolvedValue(rowWithStatus('in_progress'));
    userRepository.findById.mockResolvedValue({ id: 'user-viewer', technicianId: null });

    await expect(requestService.changeStatus('req-1', 'done', { user: VIEWER })).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('без пользователя в контексте запроса доступ закрыт', async () => {
    requestRepository.findRowForUpdate.mockResolvedValue(rowWithStatus('in_progress'));

    await expect(requestService.changeStatus('req-1', 'done')).rejects.toBeInstanceOf(ForbiddenError);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });
});
