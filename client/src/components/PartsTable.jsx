import { LOW_STOCK_THRESHOLD } from '../constants.js';
import { assetUrl } from '../api.js';
import SafeImage from './SafeImage.jsx';
import { useLightbox } from './LightboxProvider.jsx';

const COLUMNS = [
  { key: 'photo', label: '' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'part_number', label: 'Part #' },
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' },
  { key: 'quantity', label: 'Qty', sortable: true },
  { key: 'unit_price', label: 'Unit Price', sortable: true, sortKey: 'price' },
  { key: 'condition', label: 'Condition' },
  { key: 'storage_location', label: 'Location' },
];

const PartIcon = () => <span className="thumb placeholder" aria-hidden>📦</span>;

function formatPrice(value) {
  if (value == null) return '—';
  return `$${Number(value).toFixed(2)}`;
}

export default function PartsTable({ parts, sort, order, onSort, onView, onEdit, onDelete, onAdjustQuantity }) {
  const openLightbox = useLightbox();
  const arrow = (key) => (sort === key ? (order === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div className="table-wrap">
      <table className="parts-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const sortKey = col.sortKey || col.key;
              return (
                <th
                  key={col.key}
                  className={col.sortable ? 'sortable' : ''}
                  onClick={col.sortable ? () => onSort(sortKey) : undefined}
                >
                  {col.label}{col.sortable ? arrow(sortKey) : ''}
                </th>
              );
            })}
            <th aria-label="actions" />
          </tr>
        </thead>
        <tbody>
          {parts.map((part) => {
            const low = part.quantity <= LOW_STOCK_THRESHOLD;
            return (
              <tr key={part.id} className="clickable-row" onClick={() => onView(part)}>
                <td className="thumb-cell" data-label="">
                  <SafeImage
                    src={assetUrl(part.photo_url)}
                    alt={part.name}
                    className="thumb"
                    fallback={<PartIcon />}
                    onClick={part.photo_url ? (e) => { e.stopPropagation(); openLightbox(part.photo_url); } : undefined}
                  />
                </td>
                <td data-label="Name">{part.name}</td>
                <td data-label="Part #">{part.part_number || '—'}</td>
                <td data-label="Category">{part.category || '—'}</td>
                <td data-label="Brand">{part.brand || '—'}</td>
                <td data-label="Qty" onClick={(e) => e.stopPropagation()}>
                  <div className="qty-cell">
                    <button
                      className="qty-btn"
                      title="Decrease quantity"
                      aria-label={`Decrease quantity of ${part.name}`}
                      onClick={() => onAdjustQuantity(part, -1)}
                      disabled={part.quantity <= 0}
                    >−</button>
                    <span className={low ? 'badge badge-low' : 'badge badge-ok'}>
                      {part.quantity}
                    </span>
                    <button
                      className="qty-btn"
                      title="Increase quantity"
                      aria-label={`Increase quantity of ${part.name}`}
                      onClick={() => onAdjustQuantity(part, 1)}
                    >+</button>
                  </div>
                  {low && <span className="low-stock-flag" title="Low stock">⚠ low</span>}
                </td>
                <td data-label="Unit Price">{formatPrice(part.unit_price)}</td>
                <td data-label="Condition">{part.condition || '—'}</td>
                <td data-label="Location">{part.storage_location || '—'}</td>
                <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" title="View" aria-label={`View ${part.name}`} onClick={() => onView(part)}>👁</button>
                  <button className="icon-btn" title="Edit" aria-label={`Edit ${part.name}`} onClick={() => onEdit(part)}>✎</button>
                  <button className="icon-btn danger" title="Delete" aria-label={`Delete ${part.name}`} onClick={() => onDelete(part)}>🗑</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
