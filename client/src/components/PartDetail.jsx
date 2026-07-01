import { assetUrl } from '../api.js';
import { LOW_STOCK_THRESHOLD } from '../constants.js';
import { formatMoney } from '../format.js';
import SafeImage from './SafeImage.jsx';
import { useLightbox } from './LightboxProvider.jsx';

function Row({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value ?? '—'}</span>
    </div>
  );
}

// The part's name is shown in the enclosing modal header, so it isn't repeated
// here. Layout: hero photo, a metrics strip (stock / unit price / total value),
// a details grid, then free-form notes.
export default function PartDetail({ part }) {
  const openLightbox = useLightbox();
  const low = part.quantity <= LOW_STOCK_THRESHOLD;
  const hasPrice = part.unit_price != null;
  const price = hasPrice ? formatMoney(part.unit_price) : '—';
  const totalValue = hasPrice ? formatMoney(Number(part.unit_price) * part.quantity) : '—';

  return (
    <div className="part-detail">
      <SafeImage
        src={assetUrl(part.photo_url)}
        alt={part.name}
        className="detail-photo clickable"
        onClick={() => openLightbox(part.photo_url)}
        fallback={<div className="detail-photo placeholder">No photo</div>}
      />

      {(part.brand || part.category) && (
        <p className="detail-subtitle">{[part.brand, part.category].filter(Boolean).join(' · ')}</p>
      )}

      <div className="detail-metrics">
        <div className="metric">
          <span className="metric-label">In stock</span>
          <span className="metric-stock">
            <span className={low ? 'badge badge-low' : 'badge badge-ok'}>{part.quantity}</span>
            {low && <span className="low-stock-flag">⚠ low</span>}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Unit price</span>
          <span className="metric-value">{price}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Total value</span>
          <span className="metric-value">{totalValue}</span>
        </div>
      </div>

      <div className="detail-grid">
        <Row label="Part Number" value={part.part_number} />
        <Row label="Condition" value={part.condition} />
        <Row label="Storage Location" value={part.storage_location} />
        <Row label="Barcode" value={part.barcode} />
        <Row label="Purchase Date" value={part.purchase_date ? part.purchase_date.slice(0, 10) : null} />
      </div>

      {part.notes && (
        <div className="detail-notes">
          <span className="detail-label">Notes</span>
          <p className="detail-value">{part.notes}</p>
        </div>
      )}
    </div>
  );
}
