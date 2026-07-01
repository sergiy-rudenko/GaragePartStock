// Promote a user to the admin role by email. Idempotent (re-running on an
// already-admin user is a no-op). No credentials are hardcoded.
//
// Usage (from the server/ directory):
//   node scripts/promote-admin.mjs you@example.com
//
// Equivalent SQL (also idempotent):
//   UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
import { pool } from '../src/db.js';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/promote-admin.mjs <email>');
  process.exit(1);
}

try {
  const { rows } = await pool.query(
    "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role",
    [email]
  );
  if (!rows.length) {
    console.error(`No user with email ${email}. Sign up first, then re-run.`);
    process.exitCode = 1;
  } else {
    console.log(`Promoted ${rows[0].email} (id ${rows[0].id}) to role '${rows[0].role}'.`);
  }
} catch (err) {
  console.error('promote-admin failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
