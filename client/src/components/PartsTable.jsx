import { LOW_STOCK_THRESHOLD } from '../constants.js';
import { assetUrl } from '../api.js';

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

function formatPrice(value) {
  if (value == null) return '—';
  return `$${Number(value).toFixed(2)}`;
}

export default function PartsTable({ parts, sort, order, onSort, onView, onEdit, onDelete, onAdjustQuantity }) {
  if (parts.length === 0) {
    return <p className="muted">No parts match your filters.</p>;
  }

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
                <td className="thumb-cell">
                  {part.photo_url ? (
                    <img className="thumb" src={assetUrl(part.photo_url)} alt={part.name} />
                  ) : (
                    <span className="thumb placeholder" aria-hidden>📦</span>
                  )}
                </td>
                <td>{part.name}</td>
                <td>{part.part_number || '—'}</td>
                <td>{part.category || '—'}</td>
                <td>{part.brand || '—'}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="qty-cell">
                    <button
                      className="qty-btn"
                      title="Decrease"
                      onClick={() => onAdjustQuantity(part, -1)}
                      disabled={part.quantity <= 0}
                    >−</button>
                    <span className={low ? 'badge badge-low' : 'badge badge-ok'}>
                      {part.quantity}
                    </span>
                    <button
                      className="qty-btn"
                      title="Increase"
                      onClick={() => onAdjustQuantity(part, 1)}
                    >+</button>
                  </div>
                  {low && <span className="low-stock-flag" title="Low stock">⚠ low</span>}
                </td>
                <td>{formatPrice(part.unit_price)}</td>
                <td>{part.condition || '—'}</td>
                <td>{part.storage_location || '—'}</td>
                <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" title="View" onClick={() => onView(part)}>👁</button>
                  <button className="icon-btn" title="Edit" onClick={() => onEdit(part)}>✎</button>
                  <button className="icon-btn danger" title="Delete" onClick={() => onDelete(part)}>🗑</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
