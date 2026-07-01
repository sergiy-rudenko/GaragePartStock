import { assetUrl } from '../api.js';
import { formatMoney } from '../format.js';
import SafeImage from './SafeImage.jsx';
import { PartsTableSkeleton } from './Skeleton.jsx';
import { useLightbox } from './LightboxProvider.jsx';

const PartIcon = () => <span className="thumb placeholder" aria-hidden>📦</span>;

// Cross-car view of every part at/below the low-stock threshold, with a button
// to jump to the owning car.
export default function LowStockView({ results, loading, threshold, onGoToCar, onBack }) {
  const openLightbox = useLightbox();

  return (
    <section className="parts-panel">
      <div className="panel-header">
        <div>
          <h2>Low stock</h2>
          <p className="muted small">
            {loading
              ? 'Loading…'
              : `${results.length} part${results.length === 1 ? '' : 's'} at or below ${threshold} in stock`}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
      </div>

      {loading ? (
        <PartsTableSkeleton />
      ) : results.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji" aria-hidden>✅</div>
          <div>
            <h3 className="empty-title">Everything's well stocked</h3>
            <p>No parts are at or below {threshold} in stock.</p>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="parts-table">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Category</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Car</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {results.map((part) => {
                const carLabel = `${part.car_year} ${part.car_make} ${part.car_model}`;
                return (
                  <tr key={part.id} className="low-row">
                    <td className="thumb-cell" data-label="">
                      <SafeImage
                        src={assetUrl(part.photo_url)}
                        alt={part.name}
                        className="thumb"
                        fallback={<PartIcon />}
                        onClick={part.photo_url ? () => openLightbox(part.photo_url) : undefined}
                      />
                    </td>
                    <td data-label="Name">{part.name}</td>
                    <td data-label="Category">{part.category || '—'}</td>
                    <td data-label="Qty">
                      <span className="badge badge-low">{part.quantity}</span>
                    </td>
                    <td data-label="Unit Price">{part.unit_price != null ? formatMoney(part.unit_price) : '—'}</td>
                    <td data-label="Car">
                      {carLabel}
                      {part.car_nickname && <span className="car-nickname"> “{part.car_nickname}”</span>}
                    </td>
                    <td className="row-actions">
                      <button className="btn btn-secondary" onClick={() => onGoToCar(part)}>
                        Go to car →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
