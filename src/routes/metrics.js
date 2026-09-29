import { Router } from 'express';
import { metricsHandler } from '../lib/metrics.js';

const router = Router();

router.get('/', metricsHandler);

export default router;
