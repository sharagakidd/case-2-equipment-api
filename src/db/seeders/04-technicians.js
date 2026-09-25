// 04. Техники: пять специалистов с разными профилями для назначений на заявки.
const TECHNICIANS = [
  { fullName: 'Иванов Иван Иванович', specialization: 'Механик', employeeNumber: 'EMP-001' },
  { fullName: 'Петров Пётр Петрович', specialization: 'Электромонтёр', employeeNumber: 'EMP-002' },
  { fullName: 'Сидорова Анна Сергеевна', specialization: 'Инженер-электроник', employeeNumber: 'EMP-003' },
  { fullName: 'Кузнецов Дмитрий Олегович', specialization: 'Механик', employeeNumber: 'EMP-004' },
  { fullName: 'Морозов Алексей Викторович', specialization: 'Инженер КИПиА', employeeNumber: 'EMP-005' },
];

export async function up(queryInterface) {
  const createdAt = new Date('2026-02-02T07:30:00Z');

  await queryInterface.bulkInsert(
    'technicians',
    TECHNICIANS.map((technician) => ({
      full_name: technician.fullName,
      specialization: technician.specialization,
      employee_number: technician.employeeNumber,
      createdAt,
      updatedAt: createdAt,
    })),
    {},
  );
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query('DELETE FROM technicians WHERE employee_number IN (:numbers)', {
    replacements: { numbers: TECHNICIANS.map((technician) => technician.employeeNumber) },
  });
}
