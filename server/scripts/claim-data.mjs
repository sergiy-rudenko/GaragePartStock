// Assign ownership of pre-auth rows (user_id IS NULL) in cars/parts/tools to a
// target user. Idempotent: only rows with a NULL user_id are updated, so it is
// safe to run repeatedly and it never reassigns already-owned data.
//
// Usage (from the server/ directory):
//   node scripts/claim-data.mjs                  # first/oldest user (lowest id)
//   node scripts/claim-data.mjs --email a@b.com  # a specific user by email
//   node scripts/claim-data.mjs --user-id 3      # a specific user by id
import { pool } from '../src/db.js';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function resolveUserId() {
  const userId = arg('--user-id');
  const email = arg('--email');

  if (userId !== undefined) {
    const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [Number(userId)]);
    if (!rows.length) throw new Error(`No user with id ${userId}`);
    return rows[0].id;
  }
  if (email !== undefined) {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (!rows.length) throw new Error(`No user with email ${email}`);
    return rows[0].id;
  }
  const { rows } = await pool.query('SELECT id, email FROM users ORDER BY id ASC LIMIT 1');
  if (!rows.length) throw new Error('No users exist yet — sign up first, then re-run.');
  console.log(`No user specified; defaulting to first user: ${rows[0].email} (id ${rows[0].id})`);
  return rows[0].id;
}

try {
  const uid = await resolveUserId();
  for (const table of ['cars', 'parts', 'tools']) {
    const { rowCount } = await pool.query(
      `UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`,
      [uid]
    );
    console.log(`${table}: claimed ${rowCount} unowned row(s) for user ${uid}`);
  }
  console.log('Done.');
} catch (err) {
  console.error('claim-data failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
