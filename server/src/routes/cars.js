import { Router } from 'express';
import { query } from '../db.js';
import { validateCar, toIntOrNull, ValidationError } from '../validation.js';
import { localizePhotoUrl } from '../uploads.js';
import { LOW_STOCK_THRESHOLD } from '../constants.js';

const router = Router();

// Wrap async handlers so thrown errors reach the error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/cars — list all cars with part counts, total inventory value, and
// how many of their parts are low on stock.
router.get('/', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT c.*,
            COUNT(p.id)::int AS part_count,
            COALESCE(SUM(p.quantity * COALESCE(p.unit_price, 0)), 0)::float8 AS total_value,
            COUNT(p.id) FILTER (WHERE p.quantity <= $1)::int AS low_stock_count
       FROM cars c
       LEFT JOIN parts p ON p.car_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC`,
    [LOW_STOCK_THRESHOLD]
  );
  res.json(rows);
}));

// GET /api/cars/:id — single car
router.get('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rows } = await query('SELECT * FROM cars WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Car not found' });
  res.json(rows[0]);
}));

// POST /api/cars — create
router.post('/', wrap(async (req, res) => {
  const c = validateCar(req.body);

  // Persist any external/remote image locally at save time (same as parts).
  await localizePhotoUrl(c);

  const { rows } = await query(
    `INSERT INTO cars (make, model, year, vin, nickname, photo_url)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [c.make, c.model, c.year, c.vin ?? null, c.nickname ?? null, c.photo_url ?? null]
  );
  res.status(201).json(rows[0]);
}));

// PUT /api/cars/:id — update (full or partial merge)
router.put('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const c = validateCar(req.body, { partial: true });
  const fields = Object.keys(c);
  if (fields.length === 0) throw new ValidationError('No valid fields to update');

  // Localize a newly-provided remote image (skip when photo_url isn't being set).
  if (c.photo_url !== undefined) await localizePhotoUrl(c);

  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => c[f]);
  values.push(id);

  const { rows } = await query(
    `UPDATE cars SET ${setClause} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Car not found' });
  res.json(rows[0]);
}));

// DELETE /api/cars/:id — delete (cascades to parts)
router.delete('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rowCount } = await query('DELETE FROM cars WHERE id = $1', [id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Car not found' });
  res.status(204).end();
}));

export default router;
