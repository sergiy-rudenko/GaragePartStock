import { useRef, useState } from 'react';
import { TOOL_CONDITIONS } from '../constants.js';
import { lookupApi } from '../api.js';
import BarcodeScanner from './BarcodeScanner.jsx';
import PhotoField from './PhotoField.jsx';

const empty = {
  name: '', brand: '', category: '', quantity: '0',
  unit_price: '', storage_location: '', condition: '', notes: '', purchase_date: '',
  photo_url: '', barcode: '',
};

export default function ToolForm({ initial, categories = [], onSubmit, onCancel }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({ ...empty, ...sanitize(initial) });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const [lookup, setLookup] = useState(null); // { status: 'loading'|'filled'|'none', message }
  const [errors, setErrors] = useState({});
  const lastLookupRef = useRef('');

  const change = (e) => {
    const { name } = e.target;
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((errs) => (errs[name] ? { ...errs, [name]: undefined } : errs));
  };
  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.quantity !== '' && (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 0)) {
      errs.quantity = 'Quantity must be a whole number ≥ 0';
    }
    if (form.unit_price !== '' && (Number.isNaN(Number(form.unit_price)) || Number(form.unit_price) < 0)) {
      errs.unit_price = 'Price must be a number ≥ 0';
    }
    return errs;
  }

  // Resolve a barcode via the same lookup parts use: a local match (an existing
  // part with this barcode) surfaces as a note, an external match auto-fills
  // empty fields, otherwise manual entry. Best-effort — failures never block.
  async function resolveBarcode(rawValue) {
    const value = (rawValue || '').trim();
    if (!value || isEdit) return;              // auto-lookup is for the add form only
    if (value === lastLookupRef.current) return;
    lastLookupRef.current = value;

    setDuplicate(null);
    setLookup({ status: 'loading' });
    try {
      const res = await lookupApi.byBarcode(value);

      if (res.match === 'local') {
        setDuplicate(res.part);
        setLookup(null);
        return;
      }

      if (res.match === 'external' && res.product) {
        const p = res.product;
        setForm((f) => ({
          ...f,
          name: f.name || p.name || '',
          brand: f.brand || p.brand || '',
          category: f.category || p.category || '',
          photo_url: f.photo_url || p.image_url || '',
        }));
        setLookup({ status: 'filled', message: `Auto-filled from ${res.source || 'product database'}.` });
        return;
      }

      setLookup({
        status: 'none',
        message: res.warning || 'No product match found — enter details manually.',
      });
    } catch {
      setLookup({ status: 'none', message: 'Lookup unavailable — enter details manually.' });
    }
  }

  function applyScannedBarcode(value) {
    setScanning(false);
    setField('barcode', value);
    resolveBarcode(value);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      await onSubmit({
        name: form.name,
        brand: form.brand || null,
        category: form.category || null,
        quantity: form.quantity === '' ? 0 : Number(form.quantity),
        unit_price: form.unit_price === '' ? null : Number(form.unit_price),
        storage_location: form.storage_location || null,
        condition: form.condition || null,
        notes: form.notes || null,
        purchase_date: form.purchase_date || null,
        photo_url: form.photo_url || null,
        barcode: form.barcode || null,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (scanning) {
    return <BarcodeScanner onScan={applyScannedBarcode} onCancel={() => setScanning(false)} />;
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}

      {duplicate && (
        <div className="dup-banner">
          A part with barcode <strong>{form.barcode}</strong> already exists in your parts
          inventory: <strong>{duplicate.name}</strong> (qty {duplicate.quantity}).
          <button type="button" className="link-btn" onClick={() => setDuplicate(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="form-grid">
        <label>
          Name *
          <input name="name" value={form.name} onChange={change} aria-invalid={!!errors.name} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <label>
          Brand
          <input name="brand" value={form.brand} onChange={change} />
        </label>
        <label>
          Category
          <input
            name="category"
            value={form.category}
            onChange={change}
            list="tool-category-suggestions"
            autoComplete="off"
            placeholder="Start typing…"
          />
          <datalist id="tool-category-suggestions">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label>
          Quantity
          <input name="quantity" type="number" min="0" value={form.quantity} onChange={change} aria-invalid={!!errors.quantity} />
          {errors.quantity && <span className="field-error">{errors.quantity}</span>}
        </label>
        <label>
          Unit Price
          <input name="unit_price" type="number" min="0" step="0.01" value={form.unit_price} onChange={change} aria-invalid={!!errors.unit_price} />
          {errors.unit_price && <span className="field-error">{errors.unit_price}</span>}
        </label>
        <label>
          Storage Location
          <input name="storage_location" value={form.storage_location} onChange={change} />
        </label>
        <label>
          Condition
          <select name="condition" value={form.condition} onChange={change}>
            <option value="">—</option>
            {TOOL_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Purchase Date
          <input name="purchase_date" type="date" value={form.purchase_date} onChange={change} />
        </label>
        <label>
          Barcode / QR
          <div className="input-with-btn">
            <input
              name="barcode"
              value={form.barcode}
              onChange={change}
              onBlur={(e) => resolveBarcode(e.target.value)}
              placeholder="UPC / EAN / QR"
            />
            <button type="button" className="btn btn-secondary" onClick={() => setScanning(true)}>📷 Scan</button>
          </div>
          {lookup?.status === 'loading' && <span className="muted small">Looking up product…</span>}
          {lookup?.status === 'filled' && <span className="lookup-ok small">✓ {lookup.message}</span>}
          {lookup?.status === 'none' && <span className="muted small">{lookup.message}</span>}
        </label>
      </div>

      <PhotoField
        value={form.photo_url}
        onChange={(url) => setField('photo_url', url)}
        onBusyChange={setUploading}
      />

      <label>
        Notes
        <textarea name="notes" rows="3" value={form.notes} onChange={change} />
      </label>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function sanitize(tool) {
  if (!tool) return {};
  return {
    name: tool.name ?? '',
    brand: tool.brand ?? '',
    category: tool.category ?? '',
    quantity: tool.quantity != null ? String(tool.quantity) : '0',
    unit_price: tool.unit_price != null ? String(tool.unit_price) : '',
    storage_location: tool.storage_location ?? '',
    condition: tool.condition ?? '',
    notes: tool.notes ?? '',
    purchase_date: tool.purchase_date ? tool.purchase_date.slice(0, 10) : '',
    photo_url: tool.photo_url ?? '',
    barcode: tool.barcode ?? '',
  };
}
