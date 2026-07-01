import { useState } from 'react';
import { partsApi } from '../api.js';
import { parseCsv, IMPORTABLE_FIELDS } from '../csv.js';
import { CONDITIONS } from '../constants.js';
import { useToast } from './ToastProvider.jsx';

// Build a part payload from a parsed CSV row, keeping only recognized columns
// (extra columns such as the car_* prefix from an all-parts export are ignored).
function rowToPayload(row) {
  const p = {};
  IMPORTABLE_FIELDS.forEach((f) => {
    if (row[f] !== undefined && row[f] !== '') p[f] = row[f];
  });
  return p;
}

// Client-side pre-validation mirroring the server rules, so the preview flags
// problems before anything is sent.
function rowError(row) {
  if (!row.name || !row.name.trim()) return 'Name is required';
  if (row.quantity) {
    const q = Number(row.quantity);
    if (!Number.isInteger(q) || q < 0) return 'Quantity must be a whole number ≥ 0';
  }
  if (row.unit_price) {
    const v = Number(row.unit_price);
    if (Number.isNaN(v) || v < 0) return 'Price must be a number ≥ 0';
  }
  if (row.condition && !CONDITIONS.includes(row.condition)) {
    return `Condition must be one of: ${CONDITIONS.join(', ')}`;
  }
  return null;
}

export default function CsvImport({ carId, carLabel, templateUrl, onClose, onImported }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { headers, rows: parsed } = parseCsv(String(reader.result));
        if (!headers.includes('name')) {
          setRows(null);
          setParseError('CSV must include a "name" column.');
          return;
        }
        setRows(parsed);
      } catch {
        setRows(null);
        setParseError('Could not read this file as CSV.');
      }
    };
    reader.onerror = () => setParseError('Could not read the selected file.');
    reader.readAsText(file);
  }

  const analyzed = rows ? rows.map((r) => ({ row: r, error: rowError(r) })) : [];
  const validCount = analyzed.filter((a) => !a.error).length;
  const invalidCount = analyzed.length - validCount;

  async function handleImport() {
    const payloads = analyzed.filter((a) => !a.error).map((a) => rowToPayload(a.row));
    if (payloads.length === 0) return;
    setImporting(true);
    try {
      const { created } = await partsApi.importParts(carId, payloads);
      toast.success(`Imported ${created} part${created === 1 ? '' : 's'}`);
      onImported?.();
      onClose();
    } catch (err) {
      toast.error(`Import failed: ${err.message}`);
      setImporting(false);
    }
  }

  return (
    <div className="csv-import">
      <p className="muted small">
        Add parts to <strong>{carLabel}</strong> from a CSV file. Recognized columns:{' '}
        <code>{IMPORTABLE_FIELDS.join(', ')}</code>. Only <code>name</code> is required.{' '}
        <a href={templateUrl}>Download a template</a>.
      </p>

      <input type="file" accept=".csv,text/csv" onChange={handleFile} aria-label="Choose a CSV file" />

      {parseError && <div className="form-error">{parseError}</div>}

      {rows && (
        <>
          <div className="import-summary">
            <span className="badge badge-ok">{validCount} ready</span>
            {invalidCount > 0 && <span className="badge badge-low">{invalidCount} with errors</span>}
            {fileName && <span className="muted small">from {fileName}</span>}
          </div>

          {rows.length === 0 ? (
            <p className="muted">No data rows found in this file.</p>
          ) : (
            <div className="table-wrap import-preview">
              <table className="parts-table density-compact">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Category</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analyzed.map((a, i) => (
                    <tr key={i} className={a.error ? 'low-row' : ''}>
                      <td data-label="#">{i + 1}</td>
                      <td data-label="Name">{a.row.name || <span className="muted">—</span>}</td>
                      <td data-label="Qty">{a.row.quantity || '—'}</td>
                      <td data-label="Unit Price">{a.row.unit_price || '—'}</td>
                      <td data-label="Category">{a.row.category || '—'}</td>
                      <td data-label="Status">
                        {a.error
                          ? <span className="field-error">{a.error}</span>
                          : <span className="lookup-ok small">✓ ready</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invalidCount > 0 && validCount > 0 && (
            <p className="muted small">Rows with errors will be skipped.</p>
          )}
        </>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleImport}
          disabled={importing || validCount === 0}
        >
          {importing ? 'Importing…' : `Import ${validCount} part${validCount === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
