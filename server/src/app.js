import { mkdirSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import carsRouter from './routes/cars.js';
import partsRouter from './routes/parts.js';
import lookupRouter from './routes/lookup.js';
import statsRouter from './routes/stats.js';
import { UPLOADS_DIR } from './uploads.js';

export function createApp() {
  const app = express();

  // Ensure the uploads directory exists before serving from it.
  mkdirSync(UPLOADS_DIR, { recursive: true });

  const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());
  app.use(cors({ origin: origins }));
  app.use(express.json());

  // Serve uploaded part images statically at /uploads/<filename>.
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/cars', carsRouter);
  app.use('/api/parts', partsRouter);
  app.use('/api/lookup', lookupRouter);
  app.use('/api/stats', statsRouter);

  // 404 for unknown API routes
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Centralized error handler — returns JSON for all errors.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    // Multer surfaces upload problems (e.g. file too large) via its own error type.
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }

    const status = err.status || 500;
    if (status >= 500) console.error(err);

    // Map common PostgreSQL errors to friendly messages.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A record with that unique value already exists' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Referenced record does not exist' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ error: 'A value violates a database constraint' });
    }

    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  return app;
}
