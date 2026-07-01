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

// Mirrors PartDetail: hero photo, a metrics strip (stock / unit price / total
// value), a details grid, then notes. The tool's name is the modal header.
export default function ToolDetail({ tool }) {
  const openLightbox = useLightbox();
  const low = tool.quantity <= LOW_STOCK_THRESHOLD;
  const hasPrice = tool.unit_price != null;
  const price = hasPrice ? formatMoney(tool.unit_price) : '—';
  const totalValue = hasPrice ? formatMoney(Number(tool.unit_price) * tool.quantity) : '—';

  return (
    <div className="part-detail">
      <SafeImage
        src={assetUrl(tool.photo_url)}
        alt={tool.name}
        className="detail-photo clickable"
        onClick={() => openLightbox(tool.photo_url)}
        fallback={<div className="detail-photo placeholder">No photo</div>}
      />

      {(tool.brand || tool.category) && (
        <p className="detail-subtitle">{[tool.brand, tool.category].filter(Boolean).join(' · ')}</p>
      )}

      <div className="detail-metrics">
        <div className="metric">
          <span className="metric-label">In stock</span>
          <span className="metric-stock">
            <span className={low ? 'badge badge-low' : 'badge badge-ok'}>{tool.quantity}</span>
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
        <Row label="Condition" value={tool.condition} />
        <Row label="Storage Location" value={tool.storage_location} />
        <Row label="Barcode" value={tool.barcode} />
        <Row label="Purchase Date" value={tool.purchase_date ? tool.purchase_date.slice(0, 10) : null} />
      </div>

      {tool.notes && (
        <div className="detail-notes">
          <span className="detail-label">Notes</span>
          <p className="detail-value">{tool.notes}</p>
        </div>
      )}
    </div>
  );
}
