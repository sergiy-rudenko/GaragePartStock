import { Router } from 'express';
import { query } from '../db.js';
import { ValidationError } from '../validation.js';
import { hashPassword, verifyPassword, requireAuth } from '../auth.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function publicUser(u) {
  return { id: u.id, email: u.email, role: u.role };
}

// Establish a fresh, authenticated session. Regenerating first prevents session
// fixation (a pre-login session id can't be reused post-login).
function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = user.id;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

// POST /api/auth/signup — create an account and log in.
router.post('/signup', wrap(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!EMAIL_RE.test(email)) throw new ValidationError('A valid email is required');
  if (password.length < MIN_PASSWORD) {
    throw new ValidationError(`Password must be at least ${MIN_PASSWORD} characters`);
  }

  const existing = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) throw new ValidationError('An account with that email already exists');

  const password_hash = await hashPassword(password);
  const { rows } = await query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role',
    [email, password_hash]
  );
  await startSession(req, rows[0]);
  res.status(201).json(publicUser(rows[0]));
}));

// POST /api/auth/login — verify credentials and log in.
router.post('/login', wrap(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const { rows } = await query(
    'SELECT id, email, role, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  // Always run a comparison to keep timing consistent whether or not the email
  // exists, and return the same generic error either way.
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, '$2a$12$0000000000000000000000000000000000000000000000000000');
  if (!user || !ok) return res.status(401).json({ error: 'Invalid email or password' });

  await startSession(req, user);
  res.json(publicUser(user));
}));

// POST /api/auth/logout — destroy the session and clear the cookie.
router.post('/logout', (req, res, next) => {
  if (!req.session) return res.status(204).end();
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

// GET /api/auth/me — the currently authenticated user (401 if not logged in).
router.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user));
});

export default router;
