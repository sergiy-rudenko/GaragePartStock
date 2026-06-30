// Shared image-storage helpers used by both the parts and cars routes:
// the uploads directory, a multer instance for direct file uploads, and the
// logic that downloads a remote image locally so we never hot-link.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import multer from 'multer';
import { ValidationError } from './validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `img-${unique}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new ValidationError('Only image files are allowed'));
  },
});

const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// Download a remote image into the uploads dir and return its local "/uploads/..."
// path. Returns null on any failure (bad URL, non-image, too large, network),
// so callers can gracefully fall back to "no image".
export async function downloadImageToUploads(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let dest = null;
  try {
    const resp = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!resp.ok || !resp.body) return null;

    const type = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!type.startsWith('image/')) return null;

    const declared = Number(resp.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return null;

    const ext = IMAGE_EXT[type] || path.extname(new URL(url).pathname).toLowerCase() || '.jpg';
    const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    dest = path.join(UPLOADS_DIR, filename);

    await pipeline(Readable.fromWeb(resp.body), createWriteStream(dest));
    return `/uploads/${filename}`;
  } catch {
    // Clean up a partially-written file if the stream failed mid-way.
    if (dest) await unlink(dest).catch(() => {});
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// If obj.photo_url points at a remote image, download it locally and swap in the
// local path. Failures fall back to null (no image). Local paths pass through.
export async function localizePhotoUrl(obj) {
  if (obj.photo_url && /^https?:\/\//i.test(obj.photo_url)) {
    obj.photo_url = await downloadImageToUploads(obj.photo_url);
  }
}
