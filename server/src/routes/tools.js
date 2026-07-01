import { Router } from 'express';
import { query } from '../db.js';
import { validateTool, toIntOrNull, ValidationError } from '../validation.js';
import { upload, localizePhotoUrl } from '../uploads.js';

const router = Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Columns written on create/update. user_id is intentionally omitted — it is a
// forward-compat column that defaults to NULL and is unused for now.
const TOOL_COLUMNS = [
  'name', 'brand', 'category', 'quantity', 'condition',
  'storage_location', 'purchase_date', 'unit_price', 'barcode', 'photo_url', 'notes',
];

// POST /api/tools/upload — accept a single image, return its public URL.
// Defined before "/:id" routes so "upload" is not treated as an id.
router.post('/upload', upload.single('photo'), wrap(async (req, res) => {
  if (!req.file) throw new ValidationError('No file uploaded (field name must be "photo")');
  res.status(201).json({ photo_url: `/uploads/${req.file.filename}` });
}));

const SORT_COLUMNS = { name: 'name', quantity: 'quantity', price: 'unit_price', created_at: 'created_at' };

// GET /api/tools — list with filtering, search and sort.
// Query params: category, barcode (exact match),
//               search (matches name, brand or barcode),
//               sort (name|quantity|price|created_at), order (asc|desc)
router.get('/', wrap(async (req, res) => {
  const conditions = [];
  const values = [];

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
      `(name ILIKE $${values.length} OR brand ILIKE $${values.length} OR barcode ILIKE $${values.length})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortCol = SORT_COLUMNS[req.query.sort] || 'created_at';
  const order = String(req.query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const { rows } = await query(
    `SELECT * FROM tools ${where} ORDER BY ${sortCol} ${order}, id DESC`,
    values
  );
  res.json(rows);
}));

// GET /api/tools/search?q=... — find tools by name, brand or barcode.
// Defined before "/:id" so "search" is not treated as an id.
router.get('/search', wrap(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const { rows } = await query(
    `SELECT * FROM tools
      WHERE name ILIKE $1 OR brand ILIKE $1 OR barcode ILIKE $1
      ORDER BY name ASC, id DESC`,
    [`%${q}%`]
  );
  res.json(rows);
}));

// GET /api/tools/categories — distinct, non-empty categories for suggestions.
router.get('/categories', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT DISTINCT category FROM tools
      WHERE category IS NOT NULL AND category <> ''
      ORDER BY category ASC`
  );
  res.json(rows.map((r) => r.category));
}));

// GET /api/tools/:id
router.get('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rows } = await query('SELECT * FROM tools WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
  res.json(rows[0]);
}));

// POST /api/tools
router.post('/', wrap(async (req, res) => {
  const t = validateTool(req.body);

  // Persist any external product image locally at save time.
  await localizePhotoUrl(t);

  const cols = TOOL_COLUMNS;
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const values = cols.map((c) => t[c] ?? (c === 'quantity' ? 0 : null));

  const { rows } = await query(
    `INSERT INTO tools (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(rows[0]);
}));

// Shared partial-merge update handler for both PUT and PATCH /api/tools/:id.
const updateTool = wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const t = validateTool(req.body, { partial: true });
  const fields = Object.keys(t);
  if (fields.length === 0) throw new ValidationError('No valid fields to update');

  // Localize a newly-provided remote image (skip when photo_url isn't being set).
  if (t.photo_url !== undefined) await localizePhotoUrl(t);

  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => t[f]);
  values.push(id);

  const { rows } = await query(
    `UPDATE tools SET ${setClause} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
  res.json(rows[0]);
});

// PUT (full/partial) and PATCH (partial, e.g. inline quantity tweaks) share logic.
router.put('/:id', updateTool);
router.patch('/:id', updateTool);

// DELETE /api/tools/:id
router.delete('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rowCount } = await query('DELETE FROM tools WHERE id = $1', [id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Tool not found' });
  res.status(204).end();
}));

export default router;
