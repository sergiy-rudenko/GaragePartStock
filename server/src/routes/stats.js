import { Router } from 'express';
import { query } from '../db.js';
import { LOW_STOCK_THRESHOLD } from '../constants.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/stats — dashboard summary for the current user's inventory.
router.get('/', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT
        (SELECT COUNT(*)::int FROM cars  WHERE user_id = $2) AS total_cars,
        (SELECT COUNT(*)::int FROM parts WHERE user_id = $2) AS total_parts,
        (SELECT COALESCE(SUM(quantity * COALESCE(unit_price, 0)), 0)::float8
           FROM parts WHERE user_id = $2)                    AS total_value,
        (SELECT COUNT(*)::int FROM parts
          WHERE quantity <= $1 AND user_id = $2)             AS low_stock_count`,
    [LOW_STOCK_THRESHOLD, req.user.id]
  );
  res.json({ ...rows[0], low_stock_threshold: LOW_STOCK_THRESHOLD });
}));

export default router;
