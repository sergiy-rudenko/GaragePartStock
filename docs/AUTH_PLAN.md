# AUTH_PLAN.md

Authentication and per-user data isolation for GaragePartStock.

## Decision summary

- **Approach:** Self-hosted auth. Users, password hashes, and sessions all live in
  our own Postgres. No third-party identity provider.
- **Why self-hosted (not Clerk/Auth0/Supabase):** the realistic audience is the
  owner plus a few known people. The main argument for a provider — offloading
  liability for strangers' credentials — carries little weight at this scale, and a
  provider adds overhead (user-mirroring table, callback/origin config across
  localhost + phone + cluster). Everything stays in one Postgres.
- **Reconsider a provider** only if the audience shifts toward paying strangers.
  The clean local `users` model is designed to make that switch manageable.
- **Sessions:** `express-session` + `connect-pg-simple` (sessions stored in
  Postgres). Session ID rides in an **httpOnly, sameSite=lax** cookie. The frontend
  never handles a token. Logout deletes the session row.
- **Password hashing:** bcrypt (12 rounds). Raw passwords are never stored or logged.
- **Payments:** deliberately deferred. Not built. Design stays payment-ready via the
  `users` table + `role` column.
- **Skipped for now** (small trusted audience): email verification, password-reset
  emails (reset manually), login rate-limiting, social login. Revisit if the
  audience grows.

## The security model in one sentence

Every request carries the session cookie; the backend verifies it on every protected
route and scopes every database query to the verified user id. The `user_id` columns
on cars/parts/tools are where that scoping lives.

## Status — BUILT AND TESTED

All four stages plus the admin panel are implemented (commits `48f90d2`…`8ad1ff8`).

- **Stage 1 — Users + sessions:** `users` + `session` tables; bcrypt(12);
  signup/login/logout/me with session regeneration (anti-fixation) and generic login
  errors; cookie httpOnly + sameSite=lax + secure=false (local HTTP); `SESSION_SECRET`
  from env. Frontend login/signup gate the app; header shows email + logout; axios
  `withCredentials` + 401 interceptor.
- **Stage 2 — Claim data:** `scripts/claim-data.mjs` (idempotent) backfills `user_id`
  on pre-auth rows.
- **Stage 3 — Ownership enforcement (the critical stage):** global guard 401s every
  `/api` route except health/signup/login; every query scoped to the session user;
  updates/deletes verify ownership before acting; cross-table ownership enforced via
  JOIN cars; search + lookup scoped. **Isolation test: 27/27 passed**
  (`server/scripts/isolation-test.mjs`) — two users, neither can read/update/delete the
  other's data even by guessing ids (→ 404, never the other's data).
- **Stage 4 — Lock-down:** FKs `cars/parts/tools.user_id → users(id)` + `NOT NULL`,
  both guarded so re-runs are idempotent.
- **Admin panel:** `/api/admin/users` behind `requireAdmin` (role re-read from DB each
  request, enforced **server-side** — verified normal→403, anon→401, admin→200). Lists
  users + counts only; no password hashes, no session data. Frontend Admin tab is
  convenience only; the backend is the gate.

## Operational setup (after pulling)

1. Set `SESSION_SECRET` in `server/.env` (e.g. `openssl rand -base64 32`).
2. `cd server && npm install`
3. `npm run init-db`
4. Sign up through the UI.
5. `node scripts/promote-admin.mjs <your-email>` to get the Admin tab.

## Review checklist (do not skip before going public)

- [ ] Read `server/scripts/isolation-test.mjs` yourself — confirm the assertions
      actually check every verb on every resource, and that a "pass" means the other
      user's data was genuinely absent.
- [ ] Manually verify once: second account, add a car, log back in as yourself,
      confirm it is not visible.
- [ ] Confirm the leftover `node_modules/sharp` symlink (from the logo task) is
      gitignored and not committed (`git status`).

## CRITICAL for go-live

The session cookie is `secure: false` for local HTTP. **Behind HTTPS (Cloudflare
Tunnel) it MUST become `secure: true`.** This is a hard checklist item for the deploy,
not something to remember in the moment. See DEPLOYMENT.md.