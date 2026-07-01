// Minimal, dependency-free CSV serialization (RFC 4180-ish).
// Columns: [{ key, label?, format? }]. `format(value, row)` is optional.

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Quote when the value contains a comma, quote, or newline.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCell(c.label ?? c.key)).join(',');
  const body = rows.map((row) =>
    columns
      .map((c) => escapeCell(c.format ? c.format(row[c.key], row) : row[c.key]))
      .join(',')
  );
  return [header, ...body].join('\r\n');
}

// Render a DATE/TIMESTAMP value as YYYY-MM-DD (or '' when empty).
export function formatDate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
