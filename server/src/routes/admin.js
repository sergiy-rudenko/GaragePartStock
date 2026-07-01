import { Router } from 'express';
import { query } from '../db.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// NOTE: this router is mounted behind requireAuth + requireAdmin in app.js, so
// the admin role is enforced SERVER-SIDE for every route here.

// GET /api/admin/users — list all users with inventory counts.
// Deliberately selects only safe columns: never password_hash or session data.
router.get('/users', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.role, u.created_at,
            (SELECT COUNT(*)::int FROM cars  c WHERE c.user_id = u.id) AS car_count,
            (SELECT COUNT(*)::int FROM parts p WHERE p.user_id = u.id) AS part_count,
            (SELECT COUNT(*)::int FROM tools t WHERE t.user_id = u.id) AS tool_count
       FROM users u
      ORDER BY u.id ASC`
  );
  res.json(rows);
}));

export default router;
