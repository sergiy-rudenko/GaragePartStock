// Authentication & authorization middleware and password helpers.
import bcrypt from 'bcryptjs';
import { query } from './db.js';

const BCRYPT_ROUNDS = 12;

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Loads the authenticated user from the session on every request. The session
// only stores the user id; the role and existence are re-read from the database
// each request so a promoted/deleted account takes effect immediately (and a
// stale session can never carry a stale role). Rejects with 401 when there is
// no valid session.
export async function requireAuth(req, res, next) {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { rows } = await query('SELECT id, email, role FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) {
      // The account backing this session no longer exists — drop the session.
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

// Requires an authenticated admin. MUST run after requireAuth (which sets
// req.user with a fresh role from the database). This is the server-side gate
// for all admin functionality — never rely on the frontend hiding a button.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
