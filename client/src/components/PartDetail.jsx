import { assetUrl } from '../api.js';
import { LOW_STOCK_THRESHOLD } from '../constants.js';
import SafeImage from './SafeImage.jsx';
import { useLightbox } from './LightboxProvider.jsx';

function row(label, value) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value ?? '—'}</span>
    </div>
  );
}

export default function PartDetail({ part }) {
  const openLightbox = useLightbox();
  const low = part.quantity <= LOW_STOCK_THRESHOLD;
  const price = part.unit_price != null ? `$${Number(part.unit_price).toFixed(2)}` : null;

  return (
    <div className="part-detail">
      <SafeImage
        src={assetUrl(part.photo_url)}
        alt={part.name}
        className="detail-photo clickable"
        onClick={() => openLightbox(part.photo_url)}
        fallback={<div className="detail-photo placeholder">No photo</div>}
      />

      <div className="detail-grid">
        {row('Name', part.name)}
        {row('Part Number', part.part_number)}
        {row('Category', part.category)}
        {row('Brand', part.brand)}
        {row('Quantity', (
          <>
            {part.quantity}{' '}
            {low && <span className="low-stock-flag">⚠ low stock</span>}
          </>
        ))}
        {row('Unit Price', price)}
        {row('Condition', part.condition)}
        {row('Storage Location', part.storage_location)}
        {row('Barcode', part.barcode)}
        {row('Purchase Date', part.purchase_date ? part.purchase_date.slice(0, 10) : null)}
        {row('Notes', part.notes)}
      </div>
    </div>
  );
}
