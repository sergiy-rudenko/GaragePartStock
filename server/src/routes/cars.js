import { Router } from 'express';
import { query } from '../db.js';
import { validateCar, toIntOrNull, ValidationError } from '../validation.js';
import { localizePhotoUrl } from '../uploads.js';
import { LOW_STOCK_THRESHOLD } from '../constants.js';

const router = Router();

// Wrap async handlers so thrown errors reach the error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Every query below is scoped to the authenticated user (req.user.id, set by
// requireAuth). Ids from the client are never trusted on their own — reads
// filter by user_id and writes verify ownership as part of the statement.

// GET /api/cars — the current user's cars, with part counts, total value, and
// low-stock counts.
router.get('/', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT c.*,
            COUNT(p.id)::int AS part_count,
            COALESCE(SUM(p.quantity * COALESCE(p.unit_price, 0)), 0)::float8 AS total_value,
            COUNT(p.id) FILTER (WHERE p.quantity <= $1)::int AS low_stock_count
       FROM cars c
       LEFT JOIN parts p ON p.car_id = c.id
      WHERE c.user_id = $2
      GROUP BY c.id
      ORDER BY c.created_at DESC`,
    [LOW_STOCK_THRESHOLD, req.user.id]
  );
  res.json(rows);
}));

// GET /api/cars/:id — single car (must belong to the user).
router.get('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rows } = await query('SELECT * FROM cars WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Car not found' });
  res.json(rows[0]);
}));

// POST /api/cars — create, owned by the current user.
router.post('/', wrap(async (req, res) => {
  const c = validateCar(req.body);
  await localizePhotoUrl(c);

  const { rows } = await query(
    `INSERT INTO cars (make, model, year, vin, nickname, photo_url, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [c.make, c.model, c.year, c.vin ?? null, c.nickname ?? null, c.photo_url ?? null, req.user.id]
  );
  res.status(201).json(rows[0]);
}));

// PUT /api/cars/:id — update (only if it belongs to the user).
router.put('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const c = validateCar(req.body, { partial: true });
  const fields = Object.keys(c);
  if (fields.length === 0) throw new ValidationError('No valid fields to update');

  if (c.photo_url !== undefined) await localizePhotoUrl(c);

  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => c[f]);
  values.push(id, req.user.id);

  // The user_id predicate ensures a user can only update their own car.
  const { rows } = await query(
    `UPDATE cars SET ${setClause}
      WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Car not found' });
  res.json(rows[0]);
}));

// DELETE /api/cars/:id — delete (only if it belongs to the user; cascades to parts).
router.delete('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rowCount } = await query('DELETE FROM cars WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Car not found' });
  res.status(204).end();
}));

export default router;
