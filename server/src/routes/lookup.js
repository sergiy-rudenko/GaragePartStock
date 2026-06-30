import { Router } from 'express';
import { query } from '../db.js';

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const PROVIDER = process.env.BARCODE_LOOKUP_PROVIDER || 'product database';
const LOOKUP_URL = process.env.BARCODE_LOOKUP_URL || 'https://api.upcitemdb.com/prod/trial/lookup';
const API_KEY = process.env.BARCODE_LOOKUP_API_KEY || '';
const ENABLED = (process.env.BARCODE_LOOKUP_ENABLED ?? 'true').toLowerCase() !== 'false';
const TIMEOUT_MS = 6000;

// Query the external provider. Never throws — returns either { product }
// (possibly null when there is no match) or { warning } so the caller can
// respond gracefully without blocking the form.
async function fetchExternal(barcode) {
  const url = `${LOOKUP_URL}?upc=${encodeURIComponent(barcode)}`;
  const headers = { Accept: 'application/json' };
  if (API_KEY) {
    // UPCitemdb paid plans authenticate with these headers.
    headers.user_key = API_KEY;
    headers.key_type = '3scale';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers, signal: controller.signal });
    if (resp.status === 429) {
      return { warning: 'Barcode lookup rate limit reached — try again later.' };
    }
    if (!resp.ok) {
      return { warning: `Barcode lookup failed (HTTP ${resp.status}).` };
    }

    const data = await resp.json();
    const item = Array.isArray(data.items) ? data.items[0] : null;
    if (!item) return { product: null };

    // UPCitemdb categories look like "Automotive > Parts > Brakes" — keep the
    // most specific segment for a cleaner category value.
    const category = typeof item.category === 'string' && item.category.trim()
      ? item.category.split('>').pop().trim()
      : null;
    const image = Array.isArray(item.images) ? item.images.find(Boolean) : null;

    return {
      product: {
        name: item.title || null,
        brand: item.brand || null,
        category,
        image_url: image || null,
      },
    };
  } catch (err) {
    if (err.name === 'AbortError') return { warning: 'Barcode lookup timed out.' };
    return { warning: 'Barcode lookup service unavailable.' };
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/lookup/:barcode
// Resolution order:
//   1. Local DB — if a part already uses this barcode, return it (no duplicate).
//   2. External provider — return product details to pre-fill the form.
//   3. Nothing found — { match: 'none' }, leaving fields blank for manual entry.
router.get('/:barcode', wrap(async (req, res) => {
  const barcode = String(req.params.barcode || '').trim();
  if (!barcode) return res.status(400).json({ error: 'barcode is required' });

  const local = await query(
    'SELECT * FROM parts WHERE barcode = $1 ORDER BY id LIMIT 1',
    [barcode]
  );
  if (local.rows.length > 0) {
    return res.json({ match: 'local', part: local.rows[0] });
  }

  if (!ENABLED) {
    return res.json({ match: 'none' });
  }

  const ext = await fetchExternal(barcode);
  if (ext.product) {
    return res.json({ match: 'external', source: PROVIDER, product: ext.product });
  }
  return res.json({ match: 'none', warning: ext.warning || null });
}));

export default router;
