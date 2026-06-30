import { Router } from 'express';
import { query } from '../db.js';
import { validatePart, toIntOrNull, ValidationError } from '../validation.js';
import { upload, localizePhotoUrl } from '../uploads.js';

const router = Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const PART_COLUMNS = [
  'car_id', 'name', 'part_number', 'category', 'brand', 'quantity',
  'unit_price', 'storage_location', 'condition', 'notes', 'purchase_date',
  'photo_url', 'barcode',
];

// POST /api/parts/upload — accept a single image, return its public URL.
// Defined before "/:id" routes so "upload" is not treated as an id.
router.post('/upload', upload.single('photo'), wrap(async (req, res) => {
  if (!req.file) throw new ValidationError('No file uploaded (field name must be "photo")');
  res.status(201).json({ photo_url: `/uploads/${req.file.filename}` });
}));

const SORT_COLUMNS = { name: 'name', quantity: 'quantity', price: 'unit_price', created_at: 'created_at' };

// GET /api/parts — list with filtering, search and sort.
// Query params: car_id, category, barcode (exact match),
//               search (matches name, part_number or barcode),
//               sort (name|quantity|price|created_at), order (asc|desc)
router.get('/', wrap(async (req, res) => {
  const conditions = [];
  const values = [];

  if (req.query.car_id !== undefined && req.query.car_id !== '') {
    values.push(toIntOrNull(req.query.car_id, 'car_id'));
    conditions.push(`car_id = $${values.length}`);
  }
  if (req.query.category !== undefined && req.query.category !== '') {
    values.push(req.query.category);
    conditions.push(`category = $${values.length}`);
  }
  if (req.query.barcode !== undefined && req.query.barcode !== '') {
    values.push(req.query.barcode);
    conditions.push(`barcode = $${values.length}`);
  }
  if (req.query.search) {
    values.push(`%${req.query.search}%`);
    conditions.push(
      `(name ILIKE $${values.length} OR part_number ILIKE $${values.length} OR barcode ILIKE $${values.length})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortCol = SORT_COLUMNS[req.query.sort] || 'created_at';
  const order = String(req.query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const { rows } = await query(
    `SELECT * FROM parts ${where} ORDER BY ${sortCol} ${order}, id DESC`,
    values
  );
  res.json(rows);
}));

// GET /api/parts/search?q=... — find parts across ALL cars, matching name,
// part_number or barcode. Each result includes the car it belongs to.
// Defined before "/:id" so "search" is not treated as an id.
router.get('/search', wrap(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const { rows } = await query(
    `SELECT p.*,
            c.make AS car_make, c.model AS car_model,
            c.year AS car_year, c.nickname AS car_nickname
       FROM parts p
       JOIN cars c ON c.id = p.car_id
      WHERE p.name ILIKE $1 OR p.part_number ILIKE $1 OR p.barcode ILIKE $1
      ORDER BY p.name ASC, p.id DESC`,
    [`%${q}%`]
  );
  res.json(rows);
}));

// GET /api/parts/:id
router.get('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rows } = await query('SELECT * FROM parts WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Part not found' });
  res.json(rows[0]);
}));

// POST /api/parts
router.post('/', wrap(async (req, res) => {
  const p = validatePart(req.body);

  // Ensure the referenced car exists for a clearer 400 than a raw FK violation.
  const car = await query('SELECT 1 FROM cars WHERE id = $1', [p.car_id]);
  if (car.rowCount === 0) throw new ValidationError('car_id does not reference an existing car');

  // Persist any external product image locally at save time.
  await localizePhotoUrl(p);

  const cols = PART_COLUMNS;
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const values = cols.map((c) => p[c] ?? (c === 'quantity' ? 0 : null));

  const { rows } = await query(
    `INSERT INTO parts (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(rows[0]);
}));

// Shared partial-merge update handler for both PUT and PATCH /api/parts/:id.
const updatePart = wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const p = validatePart(req.body, { partial: true });
  const fields = Object.keys(p);
  if (fields.length === 0) throw new ValidationError('No valid fields to update');

  if (p.car_id !== undefined) {
    const car = await query('SELECT 1 FROM cars WHERE id = $1', [p.car_id]);
    if (car.rowCount === 0) throw new ValidationError('car_id does not reference an existing car');
  }

  // Localize a newly-provided remote image (skip when photo_url isn't being set).
  if (p.photo_url !== undefined) await localizePhotoUrl(p);

  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => p[f]);
  values.push(id);

  const { rows } = await query(
    `UPDATE parts SET ${setClause} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Part not found' });
  res.json(rows[0]);
});

// PUT (full/partial) and PATCH (partial, e.g. inline quantity tweaks) share logic.
router.put('/:id', updatePart);
router.patch('/:id', updatePart);

// DELETE /api/parts/:id
router.delete('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rowCount } = await query('DELETE FROM parts WHERE id = $1', [id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Part not found' });
  res.status(204).end();
}));

export default router;
