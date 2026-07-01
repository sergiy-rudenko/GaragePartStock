// Automated cross-user data-isolation test for Stage 3.
//
// Creates two users (A and B), each with their own car / part / tool, then
// asserts that A can never list, read, update, or delete B's cars/parts/tools —
// even when guessing B's ids — and that unauthenticated requests are rejected.
// Prints PASS/FAIL for every check and exits non-zero if any check fails.
//
// Usage (server running):  BASE=http://localhost:4061 node scripts/isolation-test.mjs
// Cleans up its own users/data afterwards via the shared pool.
import { pool } from '../src/db.js';

const BASE = process.env.BASE || 'http://localhost:4061';
const API = `${BASE}/api`;

let passed = 0;
let failed = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (ok) passed += 1; else failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

// Minimal per-user cookie jar over fetch.
function makeClient() {
  let cookie = '';
  return async function request(method, path, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    return { status: res.status, data };
  };
}

const ts = Date.now();
const emailA = `iso-a-${ts}@test.local`;
const emailB = `iso-b-${ts}@test.local`;
const PW = 'isolation-pw-123';

async function seed(client, tag) {
  const car = (await client('POST', '/cars', { make: `Make${tag}`, model: `Model${tag}`, year: 2020 })).data;
  const part = (await client('POST', '/parts', {
    car_id: car.id, name: `Part${tag}`, quantity: 3, barcode: `BC-${tag}-${ts}`,
  })).data;
  const tool = (await client('POST', '/tools', { name: `Tool${tag}`, quantity: 2, barcode: `BT-${tag}-${ts}` })).data;
  return { car, part, tool };
}

async function run() {
  const A = makeClient();
  const B = makeClient();

  // Unauthenticated access is rejected.
  const anon = makeClient();
  check('anon GET /cars → 401', (await anon('GET', '/cars')).status === 401);
  check('anon GET /tools → 401', (await anon('GET', '/tools')).status === 401);
  check('anon GET /stats → 401', (await anon('GET', '/stats')).status === 401);

  // Create both users and their data.
  const sa = await A('POST', '/auth/signup', { email: emailA, password: PW });
  const sb = await B('POST', '/auth/signup', { email: emailB, password: PW });
  check('signup A', sa.status === 201, `status ${sa.status}`);
  check('signup B', sb.status === 201, `status ${sb.status}`);

  const a = await seed(A, 'A');
  const b = await seed(B, 'B');
  check('A seeded car/part/tool', !!(a.car?.id && a.part?.id && a.tool?.id));
  check('B seeded car/part/tool', !!(b.car?.id && b.part?.id && b.tool?.id));

  // ---- LIST: A must not see any of B's rows ----
  const aCars = (await A('GET', '/cars')).data;
  check('A list cars excludes B car', Array.isArray(aCars) && !aCars.some((c) => c.id === b.car.id));
  const aParts = (await A('GET', `/parts?car_id=${b.car.id}`)).data;
  check('A list parts of B car is empty', Array.isArray(aParts) && aParts.length === 0);
  const aTools = (await A('GET', '/tools')).data;
  check('A list tools excludes B tool', Array.isArray(aTools) && !aTools.some((t) => t.id === b.tool.id));

  // ---- READ by guessed id: expect 403/404, never B's data ----
  const rCar = await A('GET', `/cars/${b.car.id}`);
  check('A GET B car → 404/403', [403, 404].includes(rCar.status), `status ${rCar.status}`);
  const rPart = await A('GET', `/parts/${b.part.id}`);
  check('A GET B part → 404/403', [403, 404].includes(rPart.status), `status ${rPart.status}`);
  const rTool = await A('GET', `/tools/${b.tool.id}`);
  check('A GET B tool → 404/403', [403, 404].includes(rTool.status), `status ${rTool.status}`);

  // ---- UPDATE B's rows: must fail ----
  const uCar = await A('PUT', `/cars/${b.car.id}`, { nickname: 'hacked' });
  check('A PUT B car → 404/403', [403, 404].includes(uCar.status), `status ${uCar.status}`);
  const uPart = await A('PATCH', `/parts/${b.part.id}`, { quantity: 999 });
  check('A PATCH B part → 404/403', [403, 404].includes(uPart.status), `status ${uPart.status}`);
  const uTool = await A('PUT', `/tools/${b.tool.id}`, { name: 'hacked' });
  check('A PUT B tool → 404/403', [403, 404].includes(uTool.status), `status ${uTool.status}`);

  // ---- Attempt to attach a part to B's car ----
  const xPart = await A('POST', '/parts', { car_id: b.car.id, name: 'sneaky', quantity: 1 });
  check('A POST part into B car → rejected', [400, 403, 404].includes(xPart.status), `status ${xPart.status}`);

  // ---- SEARCH / LOOKUP must not surface B's data ----
  const sPart = (await A('GET', `/parts/search?q=Part`)).data;
  check('A part search excludes B part', Array.isArray(sPart) && !sPart.some((p) => p.id === b.part.id));
  const sTool = (await A('GET', `/tools/search?q=Tool`)).data;
  check('A tool search excludes B tool', Array.isArray(sTool) && !sTool.some((t) => t.id === b.tool.id));
  const look = await A('GET', `/lookup/BC-B-${ts}`);
  const leaks = look.data?.match === 'local' && look.data?.part?.id === b.part.id;
  check('A lookup of B barcode does not return B part', !leaks, `match=${look.data?.match}`);

  // ---- DELETE B's rows: must fail, and B's data must survive ----
  const dCar = await A('DELETE', `/cars/${b.car.id}`);
  check('A DELETE B car → 404/403', [403, 404].includes(dCar.status), `status ${dCar.status}`);
  const dPart = await A('DELETE', `/parts/${b.part.id}`);
  check('A DELETE B part → 404/403', [403, 404].includes(dPart.status), `status ${dPart.status}`);
  const dTool = await A('DELETE', `/tools/${b.tool.id}`);
  check('A DELETE B tool → 404/403', [403, 404].includes(dTool.status), `status ${dTool.status}`);

  // B can still read its own data (nothing was mutated/deleted by A).
  const bCarStill = await B('GET', `/cars/${b.car.id}`);
  check('B car survived + unchanged', bCarStill.status === 200 && bCarStill.data?.nickname == null,
    `status ${bCarStill.status}, nickname=${bCarStill.data?.nickname}`);
  const bPartStill = await B('GET', `/parts/${b.part.id}`);
  check('B part survived + unchanged qty', bPartStill.status === 200 && bPartStill.data?.quantity === 3,
    `qty=${bPartStill.data?.quantity}`);
  const bToolStill = await B('GET', `/tools/${b.tool.id}`);
  check('B tool survived + unchanged name', bToolStill.status === 200 && bToolStill.data?.name === 'ToolB',
    `name=${bToolStill.data?.name}`);

  // B sees exactly its own single car/tool.
  const bCars = (await B('GET', '/cars')).data;
  check('B sees only its own car', Array.isArray(bCars) && bCars.length === 1 && bCars[0].id === b.car.id);
}

async function cleanup() {
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email IN ($1, $2)', [emailA, emailB]);
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      // Row-level DELETEs only (no schema changes). Cars cascade to their parts.
      await pool.query('DELETE FROM tools WHERE user_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM parts WHERE user_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM cars  WHERE user_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
    }
  } catch (err) {
    console.log(`(cleanup warning: ${err.message})`);
  } finally {
    await pool.end();
  }
}

try {
  await run();
} catch (err) {
  check('test harness completed without throwing', false, err.message);
} finally {
  await cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
