// 10. Связь учётной записи со справочником техников: специалист меняет статус
// только своих заявок, значит нужно знать, кто из справочника стоит за аккаунтом.
export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('users', 'technician_id', {
    type: Sequelize.UUID,
    allowNull: true,
    references: { model: 'technicians', key: 'id' },
    // Запись справочника удаляют — аккаунт остаётся, но теряет связь.
    onDelete: 'SET NULL',
  });

  await queryInterface.addIndex('users', ['technician_id'], { name: 'users_technician_id_idx' });
}

export async function down(queryInterface) {
  await queryInterface.removeIndex('users', 'users_technician_id_idx');
  await queryInterface.removeColumn('users', 'technician_id');
}
