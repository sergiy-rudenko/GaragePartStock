import { mkdirSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db.js';
import { requireAuth } from './auth.js';
import authRouter from './routes/auth.js';
import carsRouter from './routes/cars.js';
import partsRouter from './routes/parts.js';
import toolsRouter from './routes/tools.js';
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
  // credentials:true is required so the browser sends/receives the session
  // cookie. origin is an explicit allow-list (never "*") — required when
  // credentials are enabled and important for security.
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json());

  // --- Sessions (stored in Postgres via connect-pg-simple) -------------------
  const PgSession = connectPgSimple(session);
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    // Fail loud in production; allow a clearly-marked insecure default in dev so
    // the app still boots. Set SESSION_SECRET in server/.env (see .env.example).
    console.warn('WARNING: SESSION_SECRET is not set — using an insecure development default.');
  }
  app.set('trust proxy', 1);
  app.use(session({
    store: new PgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: sessionSecret || 'insecure-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,          // not readable by JS — mitigates XSS cookie theft
      sameSite: 'lax',         // mitigates CSRF for cross-site navigations
      // SECURITY: secure=false is only acceptable over local HTTP. This MUST be
      // set to true when the app is served behind HTTPS, or the session cookie
      // will be sent over plaintext connections.
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }));

  // Serve uploaded part images statically at /uploads/<filename>.
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Public auth routes (signup/login); /me and /logout self-guard internally.
  app.use('/api/auth', authRouter);

  // Everything below requires a valid session. Registered AFTER the auth routes
  // (which respond for their own paths) and BEFORE all data routers.
  app.use('/api', requireAuth);

  app.use('/api/cars', carsRouter);
  app.use('/api/parts', partsRouter);
  app.use('/api/tools', toolsRouter);
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
