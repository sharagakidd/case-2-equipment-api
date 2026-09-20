import express from 'express';
import router from './routes/index.js';

// Сборка приложения: парсер JSON с ограничением размера тела и API под /api/v1.
const app = express();
app.use(express.json({ limit: '100kb' }));
app.use('/api/v1', router);

export default app;
