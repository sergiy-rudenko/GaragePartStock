import { Router } from 'express';
import { pool, query } from '../db.js';
import { validatePart, toIntOrNull, ValidationError } from '../validation.js';
import { upload, localizePhotoUrl } from '../uploads.js';
import { LOW_STOCK_THRESHOLD } from '../constants.js';
import { toCsv, formatDate } from '../csv.js';

const router = Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const PART_COLUMNS = [
  'car_id', 'name', 'part_number', 'category', 'brand', 'quantity',
  'unit_price', 'storage_location', 'condition', 'notes', 'purchase_date',
  'photo_url', 'barcode',
];
// Columns actually written on insert (ownership is server-set, never client-set).
const INSERT_COLUMNS = [...PART_COLUMNS, 'user_id'];

// Every query is scoped to the authenticated user. A part is only accessible
// when BOTH the part row and its parent car belong to the user — enforced by
// joining cars and filtering on user_id in each read, and by verifying car
// ownership before every insert/update.

// Confirm the given car belongs to the user; throws a 400 otherwise (without
// revealing whether the car exists for someone else).
async function assertOwnsCar(carId, userId) {
  const car = await query('SELECT 1 FROM cars WHERE id = $1 AND user_id = $2', [carId, userId]);
  if (car.rowCount === 0) throw new ValidationError('car_id does not reference an existing car');
}

// POST /api/parts/upload — accept a single image, return its public URL.
router.post('/upload', upload.single('photo'), wrap(async (req, res) => {
  if (!req.file) throw new ValidationError('No file uploaded (field name must be "photo")');
  res.status(201).json({ photo_url: `/uploads/${req.file.filename}` });
}));

const SORT_COLUMNS = { name: 'name', quantity: 'quantity', price: 'unit_price', created_at: 'created_at' };

// GET /api/parts — list the user's parts (optionally within one of their cars).
router.get('/', wrap(async (req, res) => {
  const conditions = ['c.user_id = $1', 'p.user_id = $1'];
  const values = [req.user.id];

  if (req.query.car_id !== undefined && req.query.car_id !== '') {
    values.push(toIntOrNull(req.query.car_id, 'car_id'));
    conditions.push(`p.car_id = $${values.length}`);
  }
  if (req.query.category !== undefined && req.query.category !== '') {
    values.push(req.query.category);
    conditions.push(`p.category = $${values.length}`);
  }
  if (req.query.barcode !== undefined && req.query.barcode !== '') {
    values.push(req.query.barcode);
    conditions.push(`p.barcode = $${values.length}`);
  }
  if (req.query.search) {
    values.push(`%${req.query.search}%`);
    conditions.push(
      `(p.name ILIKE $${values.length} OR p.part_number ILIKE $${values.length} OR p.barcode ILIKE $${values.length})`
    );
  }

  const sortCol = SORT_COLUMNS[req.query.sort] || 'created_at';
  const order = String(req.query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const { rows } = await query(
    `SELECT p.* FROM parts p
       JOIN cars c ON c.id = p.car_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.${sortCol} ${order}, p.id DESC`,
    values
  );
  res.json(rows);
}));

// GET /api/parts/search?q=... — search the user's parts across their cars.
router.get('/search', wrap(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const { rows } = await query(
    `SELECT p.*,
            c.make AS car_make, c.model AS car_model,
            c.year AS car_year, c.nickname AS car_nickname
       FROM parts p
       JOIN cars c ON c.id = p.car_id
      WHERE c.user_id = $1 AND p.user_id = $1
        AND (p.name ILIKE $2 OR p.part_number ILIKE $2 OR p.barcode ILIKE $2)
      ORDER BY p.name ASC, p.id DESC`,
    [req.user.id, `%${q}%`]
  );
  res.json(rows);
}));

// GET /api/parts/low-stock — the user's low-stock parts, with their car.
router.get('/low-stock', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT p.*,
            c.make AS car_make, c.model AS car_model,
            c.year AS car_year, c.nickname AS car_nickname
       FROM parts p
       JOIN cars c ON c.id = p.car_id
      WHERE c.user_id = $1 AND p.user_id = $1 AND p.quantity <= $2
      ORDER BY p.quantity ASC, p.name ASC`,
    [req.user.id, LOW_STOCK_THRESHOLD]
  );
  res.json(rows);
}));

// GET /api/parts/categories — the user's distinct categories.
router.get('/categories', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT DISTINCT category FROM parts
      WHERE user_id = $1 AND category IS NOT NULL AND category <> ''
      ORDER BY category ASC`,
    [req.user.id]
  );
  res.json(rows.map((r) => r.category));
}));

const CSV_PART_COLUMNS = [
  { key: 'name' },
  { key: 'part_number' },
  { key: 'category' },
  { key: 'brand' },
  { key: 'quantity' },
  { key: 'unit_price' },
  { key: 'storage_location' },
  { key: 'condition' },
  { key: 'purchase_date', format: formatDate },
  { key: 'barcode' },
  { key: 'notes' },
];

// GET /api/parts/export?car_id= — CSV of one of the user's cars, or all of the
// user's parts.
router.get('/export', wrap(async (req, res) => {
  const hasCar = req.query.car_id !== undefined && req.query.car_id !== '';
  let rows;
  let columns;
  let filename;

  if (hasCar) {
    const carId = toIntOrNull(req.query.car_id, 'car_id');
    await assertOwnsCar(carId, req.user.id);
    ({ rows } = await query(
      'SELECT * FROM parts WHERE car_id = $1 AND user_id = $2 ORDER BY name ASC',
      [carId, req.user.id]
    ));
    columns = CSV_PART_COLUMNS;
    filename = `car-${carId}-parts.csv`;
  } else {
    ({ rows } = await query(
      `SELECT p.*, c.year AS car_year, c.make AS car_make,
              c.model AS car_model, c.nickname AS car_nickname
         FROM parts p
         JOIN cars c ON c.id = p.car_id
        WHERE c.user_id = $1 AND p.user_id = $1
        ORDER BY c.year ASC, c.make ASC, p.name ASC`,
      [req.user.id]
    ));
    columns = [
      { key: 'car_year', label: 'car_year' },
      { key: 'car_make', label: 'car_make' },
      { key: 'car_model', label: 'car_model' },
      { key: 'car_nickname', label: 'car_nickname' },
      ...CSV_PART_COLUMNS,
    ];
    filename = 'all-parts.csv';
  }

  const csv = toCsv(rows, columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}));

// POST /api/parts/import — bulk-add parts to one of the user's cars.
router.post('/import', wrap(async (req, res) => {
  const carId = toIntOrNull(req.body.car_id, 'car_id');
  if (carId === null) throw new ValidationError('car_id is required');
  await assertOwnsCar(carId, req.user.id);

  const items = Array.isArray(req.body.parts) ? req.body.parts : null;
  if (!items || items.length === 0) throw new ValidationError('parts must be a non-empty array');
  if (items.length > 1000) throw new ValidationError('Too many rows in one import (max 1000)');

  const validated = [];
  const errors = [];
  items.forEach((item, i) => {
    try {
      validated.push(validatePart({ ...item, car_id: carId }));
    } catch (err) {
      errors.push({ row: i + 1, error: err.message });
    }
  });
  if (errors.length) {
    return res.status(400).json({ error: `${errors.length} row(s) are invalid`, details: errors });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const placeholders = INSERT_COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
    let created = 0;
    for (const p of validated) {
      const values = PART_COLUMNS.map((c) => p[c] ?? (c === 'quantity' ? 0 : null));
      values.push(req.user.id);
      await client.query(
        `INSERT INTO parts (${INSERT_COLUMNS.join(', ')}) VALUES (${placeholders})`,
        values
      );
      created += 1;
    }
    await client.query('COMMIT');
    res.status(201).json({ created });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// GET /api/parts/:id — single part (must belong to the user and their car).
router.get('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rows } = await query(
    `SELECT p.* FROM parts p
       JOIN cars c ON c.id = p.car_id
      WHERE p.id = $1 AND p.user_id = $2 AND c.user_id = $2`,
    [id, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Part not found' });
  res.json(rows[0]);
}));

// POST /api/parts
router.post('/', wrap(async (req, res) => {
  const p = validatePart(req.body);
  await assertOwnsCar(p.car_id, req.user.id);
  await localizePhotoUrl(p);

  const placeholders = INSERT_COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
  const values = PART_COLUMNS.map((c) => p[c] ?? (c === 'quantity' ? 0 : null));
  values.push(req.user.id);

  const { rows } = await query(
    `INSERT INTO parts (${INSERT_COLUMNS.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(rows[0]);
}));

// Shared partial-merge update for PUT and PATCH /api/parts/:id.
const updatePart = wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const p = validatePart(req.body, { partial: true });
  const fields = Object.keys(p);
  if (fields.length === 0) throw new ValidationError('No valid fields to update');

  // If the part is being reassigned to a car, that car must also be the user's.
  if (p.car_id !== undefined) await assertOwnsCar(p.car_id, req.user.id);

  if (p.photo_url !== undefined) await localizePhotoUrl(p);

  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => p[f]);
  values.push(id, req.user.id);

  // user_id predicate ensures a user can only update their own part.
  const { rows } = await query(
    `UPDATE parts SET ${setClause}
      WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Part not found' });
  res.json(rows[0]);
});

router.put('/:id', updatePart);
router.patch('/:id', updatePart);

// DELETE /api/parts/:id
router.delete('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rowCount } = await query('DELETE FROM parts WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Part not found' });
  res.status(204).end();
}));

export default router;
