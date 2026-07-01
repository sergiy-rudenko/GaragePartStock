import { Router } from 'express';
import { query } from '../db.js';
import { validateTool, toIntOrNull, ValidationError } from '../validation.js';
import { upload, localizePhotoUrl } from '../uploads.js';

const router = Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const TOOL_COLUMNS = [
  'name', 'brand', 'category', 'quantity', 'condition',
  'storage_location', 'purchase_date', 'unit_price', 'barcode', 'photo_url', 'notes',
];
// Ownership is server-set, never client-set.
const INSERT_COLUMNS = [...TOOL_COLUMNS, 'user_id'];

// Every query is scoped to the authenticated user (req.user.id).

// POST /api/tools/upload — accept a single image, return its public URL.
router.post('/upload', upload.single('photo'), wrap(async (req, res) => {
  if (!req.file) throw new ValidationError('No file uploaded (field name must be "photo")');
  res.status(201).json({ photo_url: `/uploads/${req.file.filename}` });
}));

const SORT_COLUMNS = { name: 'name', quantity: 'quantity', price: 'unit_price', created_at: 'created_at' };

// GET /api/tools — list the user's tools with filtering, search and sort.
router.get('/', wrap(async (req, res) => {
  const conditions = ['user_id = $1'];
  const values = [req.user.id];

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

  const sortCol = SORT_COLUMNS[req.query.sort] || 'created_at';
  const order = String(req.query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const { rows } = await query(
    `SELECT * FROM tools WHERE ${conditions.join(' AND ')} ORDER BY ${sortCol} ${order}, id DESC`,
    values
  );
  res.json(rows);
}));

// GET /api/tools/search?q=... — search the user's tools by name/brand/barcode.
router.get('/search', wrap(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const { rows } = await query(
    `SELECT * FROM tools
      WHERE user_id = $1 AND (name ILIKE $2 OR brand ILIKE $2 OR barcode ILIKE $2)
      ORDER BY name ASC, id DESC`,
    [req.user.id, `%${q}%`]
  );
  res.json(rows);
}));

// GET /api/tools/categories — the user's distinct categories.
router.get('/categories', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT DISTINCT category FROM tools
      WHERE user_id = $1 AND category IS NOT NULL AND category <> ''
      ORDER BY category ASC`,
    [req.user.id]
  );
  res.json(rows.map((r) => r.category));
}));

// GET /api/tools/:id — single tool (must belong to the user).
router.get('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rows } = await query('SELECT * FROM tools WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
  res.json(rows[0]);
}));

// POST /api/tools — create, owned by the current user.
router.post('/', wrap(async (req, res) => {
  const t = validateTool(req.body);
  await localizePhotoUrl(t);

  const placeholders = INSERT_COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
  const values = TOOL_COLUMNS.map((c) => t[c] ?? (c === 'quantity' ? 0 : null));
  values.push(req.user.id);

  const { rows } = await query(
    `INSERT INTO tools (${INSERT_COLUMNS.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(rows[0]);
}));

// Shared partial-merge update for PUT and PATCH /api/tools/:id.
const updateTool = wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const t = validateTool(req.body, { partial: true });
  const fields = Object.keys(t);
  if (fields.length === 0) throw new ValidationError('No valid fields to update');

  if (t.photo_url !== undefined) await localizePhotoUrl(t);

  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => t[f]);
  values.push(id, req.user.id);

  const { rows } = await query(
    `UPDATE tools SET ${setClause}
      WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
  res.json(rows[0]);
});

router.put('/:id', updateTool);
router.patch('/:id', updateTool);

// DELETE /api/tools/:id
router.delete('/:id', wrap(async (req, res) => {
  const id = toIntOrNull(req.params.id, 'id');
  const { rowCount } = await query('DELETE FROM tools WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Tool not found' });
  res.status(204).end();
}));

export default router;
