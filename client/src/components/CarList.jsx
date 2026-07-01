import { assetUrl } from '../api.js';
import { formatMoney } from '../format.js';
import SafeImage from './SafeImage.jsx';
import { useLightbox } from './LightboxProvider.jsx';

const CarIcon = () => <span className="car-thumb-icon" aria-hidden>🚗</span>;

export default function CarList({ cars, selectedId, onSelect, onAdd, onEdit, onDelete }) {
  const openLightbox = useLightbox();

  if (cars.length === 0) {
    return (
      <div className="empty-state small-empty">
        <div className="empty-emoji" aria-hidden>🚗</div>
        <div>
          <h3 className="empty-title">No cars yet</h3>
          <p>Add your first car to start tracking its parts.</p>
        </div>
        {onAdd && (
          <button className="btn btn-primary" onClick={onAdd}>+ Add Car</button>
        )}
      </div>
    );
  }

  return (
    <ul className="car-list">
      {cars.map((car) => {
        const label = `${car.year} ${car.make} ${car.model}`;
        const partCount = car.part_count ?? 0;
        const lowCount = car.low_stock_count ?? 0;
        return (
          <li
            key={car.id}
            className={`car-card ${car.id === selectedId ? 'active' : ''}`}
            onClick={() => onSelect(car)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(car); }
            }}
            role="button"
            tabIndex={0}
            aria-pressed={car.id === selectedId}
            aria-label={`View parts for ${label}`}
          >
            <div
              className="car-thumb"
              onClick={(e) => { if (car.photo_url) { e.stopPropagation(); openLightbox(car.photo_url); } }}
            >
              <SafeImage src={assetUrl(car.photo_url)} alt={label} fallback={<CarIcon />} />
            </div>
            <div className="car-card-main">
              <strong>{label}</strong>
              {car.nickname && <span className="car-nickname">“{car.nickname}”</span>}
              <span className="muted small">
                {partCount} part{partCount === 1 ? '' : 's'} · {formatMoney(car.total_value)}
              </span>
              {lowCount > 0 && (
                <span className="car-low-flag" title={`${lowCount} part${lowCount === 1 ? '' : 's'} low on stock`}>
                  ⚠ {lowCount} low
                </span>
              )}
            </div>
            <div className="car-card-actions" onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn" title="Edit car" aria-label={`Edit ${label}`} onClick={() => onEdit(car)}>✎</button>
              <button className="icon-btn danger" title="Delete car" aria-label={`Delete ${label}`} onClick={() => onDelete(car)}>🗑</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
