import { assetUrl } from '../api.js';
import { LOW_STOCK_THRESHOLD } from '../constants.js';
import SafeImage from './SafeImage.jsx';
import { useLightbox } from './LightboxProvider.jsx';

const PartIcon = () => <span className="thumb placeholder" aria-hidden>📦</span>;

// Results of a cross-car part search. Each row shows the owning car and a
// button to jump to it.
export default function GlobalSearchResults({ query, results, loading, onGoToCar }) {
  const openLightbox = useLightbox();
  return (
    <section className="parts-panel">
      <div className="panel-header">
        <div>
          <h2>Search results</h2>
          <p className="muted small">
            {loading ? 'Searching…' : `${results.length} match${results.length === 1 ? '' : 'es'} for “${query}” across all cars`}
          </p>
        </div>
      </div>

      {!loading && results.length === 0 ? (
        <p className="muted">No parts match “{query}”.</p>
      ) : (
        <div className="table-wrap">
          <table className="parts-table">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Part #</th>
                <th>Barcode</th>
                <th>Qty</th>
                <th>Car</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {results.map((part) => {
                const low = part.quantity <= LOW_STOCK_THRESHOLD;
                const carLabel = `${part.car_year} ${part.car_make} ${part.car_model}`;
                return (
                  <tr key={part.id}>
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
                    <td data-label="Part #">{part.part_number || '—'}</td>
                    <td data-label="Barcode">{part.barcode || '—'}</td>
                    <td data-label="Qty">
                      <span className={low ? 'badge badge-low' : 'badge badge-ok'}>{part.quantity}</span>
                      {low && <span className="low-stock-flag" title="Low stock">⚠</span>}
                    </td>
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
