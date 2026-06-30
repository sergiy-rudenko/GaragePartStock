// Reads schema.sql and applies it to the database referenced by DATABASE_URL.
// Usage: npm run init-db
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', 'schema.sql');

try {
  const sql = await readFile(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Schema applied successfully.');
} catch (err) {
  console.error('Failed to apply schema:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
