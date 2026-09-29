import { jest } from '@jest/globals';
import { NotFoundError } from '../../src/errors/NotFoundError.js';
import { ValidationError } from '../../src/errors/ValidationError.js';

const requestRepository = {
  findRowForUpdate: jest.fn(),
  replaceAssignees: jest.fn(),
  findById: jest.fn(),
};

const technicianRepository = { findExistingIds: jest.fn() };

jest.unstable_mockModule('../../src/repositories/index.js', () => ({
  requestRepository,
  technicianRepository,
  equipmentRepository: {},
  userRepository: {},
}));

jest.unstable_mockModule('../../src/db/index.js', () => ({
  sequelize: { transaction: (callback) => callback({ id: 'tx' }) },
}));

const { requestService } = await import('../../src/services/requestService.js');

const TX = { transaction: { id: 'tx' } };
const TEAM = [
  { technicianId: 'tech-1', role: 'lead', hours: 4 },
  { technicianId: 'tech-2', role: 'member' },
];

beforeEach(() => {
  jest.clearAllMocks();
  requestRepository.findRowForUpdate.mockResolvedValue({ id: 'req-1', status: 'new' });
  requestRepository.replaceAssignees.mockResolvedValue(true);
  requestRepository.findById.mockResolvedValue({ id: 'req-1', assignees: TEAM });
  technicianRepository.findExistingIds.mockResolvedValue(['tech-1', 'tech-2']);
});

describe('assignTeam: состав бригады проверяется до транзакции', () => {
  const teamError = (assignees) =>
    requestService.assignTeam('req-1', assignees).then(
      () => null,
      (error) => error,
    );

  test('не список → 422 с проблемой в details, в БД не идём', async () => {
    const error = await teamError('tech-1');

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.status).toBe(422);
    expect(error.message).toBe('Некорректный состав бригады');
    expect(error.details).toEqual([{ field: 'assignees', message: 'Ожидается список исполнителей' }]);
    expect(requestRepository.findRowForUpdate).not.toHaveBeenCalled();
  });

  test('undefined вместо списка → 422', async () => {
    const error = await teamError(undefined);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.details[0].field).toBe('assignees');
  });

  test('два lead → 422', async () => {
    const team = [
      { technicianId: 'tech-1', role: 'lead' },
      { technicianId: 'tech-2', role: 'lead' },
    ];

    const error = await teamError(team);

    expect(error.details).toEqual([{ field: 'assignees', message: 'Нужен ровно один специалист с ролью lead' }]);
    expect(requestRepository.findRowForUpdate).not.toHaveBeenCalled();
  });

  test('ни одного lead → 422', async () => {
    const team = [
      { technicianId: 'tech-1', role: 'member' },
      { technicianId: 'tech-2', role: 'member' },
    ];

    const error = await teamError(team);

    expect(error.details[0].message).toMatch(/ровно один специалист с ролью lead/);
  });

  test('пустой список → 422 (нет lead)', async () => {
    const error = await teamError([]);

    expect(error).toBeInstanceOf(ValidationError);
    expect(requestRepository.findRowForUpdate).not.toHaveBeenCalled();
  });

  test('один техник дважды → 422', async () => {
    const team = [
      { technicianId: 'tech-1', role: 'lead' },
      { technicianId: 'tech-1', role: 'member' },
    ];

    const error = await teamError(team);

    expect(error.details).toEqual([{ field: 'assignees', message: 'Один техник указан несколько раз' }]);
    expect(requestRepository.findRowForUpdate).not.toHaveBeenCalled();
  });
});

describe('assignTeam: корректный состав', () => {
  test('бригада заменяется целиком, возвращается обновлённая заявка', async () => {
    const updated = { id: 'req-1', assignees: TEAM };
    requestRepository.findById.mockResolvedValue(updated);

    await expect(requestService.assignTeam('req-1', TEAM)).resolves.toBe(updated);

    expect(technicianRepository.findExistingIds).toHaveBeenCalledWith(['tech-1', 'tech-2'], TX);
    expect(requestRepository.replaceAssignees).toHaveBeenCalledWith('req-1', TEAM, TX);
  });

  test('бригада из одного специалиста проходит', async () => {
    const team = [{ technicianId: 'tech-1', role: 'lead' }];
    technicianRepository.findExistingIds.mockResolvedValue(['tech-1']);

    await requestService.assignTeam('req-1', team);

    expect(requestRepository.replaceAssignees).toHaveBeenCalledWith('req-1', team, TX);
  });
});

describe('assignTeam: несуществующие сущности', () => {
  test('несуществующая заявка → NotFoundError, состав не меняется', async () => {
    requestRepository.findRowForUpdate.mockResolvedValue(null);

    await expect(requestService.assignTeam('req-1', TEAM)).rejects.toBeInstanceOf(NotFoundError);
    expect(requestRepository.replaceAssignees).not.toHaveBeenCalled();
  });

  test('техник не найден → NotFoundError, состав не меняется', async () => {
    technicianRepository.findExistingIds.mockResolvedValue(['tech-1']);

    await expect(requestService.assignTeam('req-1', TEAM)).rejects.toBeInstanceOf(NotFoundError);
    expect(requestRepository.replaceAssignees).not.toHaveBeenCalled();
  });
});
