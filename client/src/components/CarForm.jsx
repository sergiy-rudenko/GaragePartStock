import { useState } from 'react';
import PhotoField from './PhotoField.jsx';

const empty = { make: '', model: '', year: '', vin: '', nickname: '', photo_url: '' };

export default function CarForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...empty, ...sanitize(initial) });
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const change = (e) => {
    const { name } = e.target;
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((errs) => (errs[name] ? { ...errs, [name]: undefined } : errs));
  };
  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  function validate() {
    const errs = {};
    if (!form.make.trim()) errs.make = 'Make is required';
    if (!form.model.trim()) errs.model = 'Model is required';
    const year = Number(form.year);
    if (!form.year) errs.year = 'Year is required';
    else if (!Number.isInteger(year) || year < 1885 || year > 2100) errs.year = 'Enter a year between 1885 and 2100';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      await onSubmit({
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        vin: form.vin || null,
        nickname: form.nickname || null,
        photo_url: form.photo_url || null,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="form-grid">
        <label>
          Make *
          <input name="make" value={form.make} onChange={change} aria-invalid={!!errors.make} />
          {errors.make && <span className="field-error">{errors.make}</span>}
        </label>
        <label>
          Model *
          <input name="model" value={form.model} onChange={change} aria-invalid={!!errors.model} />
          {errors.model && <span className="field-error">{errors.model}</span>}
        </label>
        <label>
          Year *
          <input name="year" type="number" value={form.year} onChange={change} aria-invalid={!!errors.year} />
          {errors.year && <span className="field-error">{errors.year}</span>}
        </label>
        <label>
          VIN
          <input name="vin" value={form.vin} onChange={change} />
        </label>
        <label>
          Nickname
          <input name="nickname" value={form.nickname} onChange={change} />
        </label>
      </div>

      <PhotoField
        value={form.photo_url}
        onChange={(url) => setField('photo_url', url)}
        onBusyChange={setUploading}
      />

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function sanitize(car) {
  if (!car) return {};
  return {
    make: car.make ?? '',
    model: car.model ?? '',
    year: car.year ?? '',
    vin: car.vin ?? '',
    nickname: car.nickname ?? '',
    photo_url: car.photo_url ?? '',
  };
}
