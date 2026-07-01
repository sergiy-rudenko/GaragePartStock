// Dependency-free CSV parsing for the import preview. Handles quoted fields,
// escaped quotes (""), and CRLF/LF line endings.

// Part fields the importer understands. Extra CSV columns (e.g. the car_* prefix
// from an all-parts export) are ignored; missing columns default to empty.
export const IMPORTABLE_FIELDS = [
  'name', 'part_number', 'category', 'brand', 'quantity', 'unit_price',
  'storage_location', 'condition', 'purchase_date', 'barcode', 'notes',
];

function normalizeHeader(h) {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

// Split raw CSV text into an array of rows, each an array of string cells.
function tokenize(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

// Parse CSV text into { headers, rows } where each row is an object keyed by
// normalized header name. Fully-blank lines are skipped.
export function parseCsv(text) {
  const raw = tokenize(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (raw.length === 0) return { headers: [], rows: [] };
  const headers = raw[0].map(normalizeHeader);
  const rows = raw.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim(); });
    return obj;
  });
  return { headers, rows };
}
