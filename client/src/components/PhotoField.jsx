import { useRef, useState } from 'react';
import { partsApi, assetUrl } from '../api.js';
import CameraCapture from './CameraCapture.jsx';
import SafeImage from './SafeImage.jsx';

// Shared photo picker used by both the part and car forms: thumbnail preview
// with Remove, plus Upload (file) and Use Camera (getUserMedia) actions.
// `value` is the current photo_url; `onChange(url)` reports the new value
// ('' to clear). `onBusyChange(bool)` lets the parent disable Save during upload.
export default function PhotoField({ value, onChange, onBusyChange, label = 'Photo' }) {
  const [uploading, setUploading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  function setBusy(b) {
    setUploading(b);
    onBusyChange?.(b);
  }

  async function uploadFile(file) {
    setError(null);
    setBusy(true);
    try {
      const { photo_url } = await partsApi.uploadPhoto(file);
      onChange(photo_url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }

  if (capturing) {
    return (
      <CameraCapture
        onCapture={(file) => { setCapturing(false); uploadFile(file); }}
        onCancel={() => setCapturing(false)}
      />
    );
  }

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {error && <div className="form-error">{error}</div>}
      <div className="photo-field">
        {value ? (
          <div className="photo-preview">
            <SafeImage
              src={assetUrl(value)}
              alt="Preview"
              fallback={<div className="photo-placeholder">Image unavailable</div>}
            />
            <button type="button" className="link-btn" onClick={() => onChange('')}>Remove</button>
          </div>
        ) : (
          <div className="photo-placeholder">{uploading ? 'Uploading…' : 'No photo'}</div>
        )}
        <div className="photo-actions">
          <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            ⬆ Upload
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setCapturing(true)} disabled={uploading}>
            📸 Use Camera
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileInput} />
        </div>
      </div>
    </div>
  );
}
