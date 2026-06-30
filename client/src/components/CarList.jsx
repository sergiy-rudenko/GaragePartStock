import { assetUrl } from '../api.js';

export default function CarList({ cars, selectedId, onSelect, onEdit, onDelete }) {
  if (cars.length === 0) {
    return <p className="muted">No cars yet. Add one to get started.</p>;
  }

  return (
    <ul className="car-list">
      {cars.map((car) => (
        <li
          key={car.id}
          className={`car-card ${car.id === selectedId ? 'active' : ''}`}
          onClick={() => onSelect(car)}
        >
          <div className="car-thumb">
            {car.photo_url ? (
              <img src={assetUrl(car.photo_url)} alt={`${car.make} ${car.model}`} />
            ) : (
              <span className="car-thumb-icon" aria-hidden>🚗</span>
            )}
          </div>
          <div className="car-card-main">
            <strong>
              {car.year} {car.make} {car.model}
            </strong>
            {car.nickname && <span className="car-nickname">“{car.nickname}”</span>}
            <span className="muted small">
              {car.part_count ?? 0} part{(car.part_count ?? 0) === 1 ? '' : 's'}
              {car.vin ? ` · VIN ${car.vin}` : ''}
            </span>
          </div>
          <div className="car-card-actions" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" title="Edit" onClick={() => onEdit(car)}>✎</button>
            <button className="icon-btn danger" title="Delete" onClick={() => onDelete(car)}>🗑</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
