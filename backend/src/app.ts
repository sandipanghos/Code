import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { authRouter } from './api/auth.routes.js';
import { configRouter } from './api/config.routes.js';
import { issuesRouter } from './api/issues.routes.js';
import { proposalsRouter } from './api/proposals.routes.js';
import { healthRouter } from './api/health.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFoundHandler } from './middleware/not-found.middleware.js';
import { env } from './utils/env.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  // Body parsing
  app.use(express.json({ limit: '10kb' }));

  // Request logging
  app.use((req, _res, next) => {
    logger.info({ method: req.method, url: req.url }, 'Incoming request');
    next();
  });

  // Routes
  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/config', configRouter);
  app.use('/api/issues', issuesRouter);
  app.use('/api/proposals', proposalsRouter);

  // Error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
