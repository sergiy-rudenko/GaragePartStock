import { useState } from 'react';
import PhotoField from './PhotoField.jsx';

const empty = { make: '', model: '', year: '', vin: '', nickname: '', photo_url: '' };

export default function CarForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...empty, ...sanitize(initial) });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        make: form.make,
        model: form.model,
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
          <input name="make" value={form.make} onChange={change} required />
        </label>
        <label>
          Model *
          <input name="model" value={form.model} onChange={change} required />
        </label>
        <label>
          Year *
          <input name="year" type="number" value={form.year} onChange={change} required />
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
