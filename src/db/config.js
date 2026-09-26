import 'dotenv/config';

// Конфиг подключения к PostgreSQL. Используется и sequelize-cli (миграции,
// сиды), и приложением через src/db/index.js — поэтому один источник правды.
export default {
  development: {
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    dialect: 'postgres',
    logging: false,
    // Служебная таблица с применёнными сидами: повторный db:seed:all их пропускает.
    seederStorage: 'sequelize',
  },
};
