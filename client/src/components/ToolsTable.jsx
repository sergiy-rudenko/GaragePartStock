import { LOW_STOCK_THRESHOLD } from '../constants.js';
import { assetUrl } from '../api.js';
import SafeImage from './SafeImage.jsx';
import { useLightbox } from './LightboxProvider.jsx';

const COLUMNS = [
  { key: 'photo', label: '' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'brand', label: 'Brand' },
  { key: 'category', label: 'Category' },
  { key: 'quantity', label: 'Qty', sortable: true },
  { key: 'unit_price', label: 'Unit Price', sortable: true, sortKey: 'price' },
  { key: 'condition', label: 'Condition' },
  { key: 'storage_location', label: 'Location' },
];

const ToolIcon = () => <span className="thumb placeholder" aria-hidden>🛠</span>;

function formatPrice(value) {
  if (value == null) return '—';
  return `$${Number(value).toFixed(2)}`;
}

export default function ToolsTable({ tools, sort, order, density = 'comfortable', onSort, onView, onEdit, onDelete, onAdjustQuantity }) {
  const openLightbox = useLightbox();
  const arrow = (key) => (sort === key ? (order === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div className="table-wrap">
      <table className={`parts-table density-${density}`}>
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
          {tools.map((tool) => {
            const low = tool.quantity <= LOW_STOCK_THRESHOLD;
            return (
              <tr key={tool.id} className={`clickable-row${low ? ' low-row' : ''}`} onClick={() => onView(tool)}>
                <td className="thumb-cell" data-label="">
                  <SafeImage
                    src={assetUrl(tool.photo_url)}
                    alt={tool.name}
                    className="thumb"
                    fallback={<ToolIcon />}
                    onClick={tool.photo_url ? (e) => { e.stopPropagation(); openLightbox(tool.photo_url); } : undefined}
                  />
                </td>
                <td data-label="Name">{tool.name}</td>
                <td data-label="Brand">{tool.brand || '—'}</td>
                <td data-label="Category">{tool.category || '—'}</td>
                <td data-label="Qty" onClick={(e) => e.stopPropagation()}>
                  <div className="qty-cell">
                    <button
                      className="qty-btn"
                      title="Decrease quantity"
                      aria-label={`Decrease quantity of ${tool.name}`}
                      onClick={() => onAdjustQuantity(tool, -1)}
                      disabled={tool.quantity <= 0}
                    >−</button>
                    <span className={low ? 'badge badge-low' : 'badge badge-ok'}>
                      {tool.quantity}
                    </span>
                    <button
                      className="qty-btn"
                      title="Increase quantity"
                      aria-label={`Increase quantity of ${tool.name}`}
                      onClick={() => onAdjustQuantity(tool, 1)}
                    >+</button>
                  </div>
                  {low && <span className="low-stock-flag" title="Low stock">⚠ low</span>}
                </td>
                <td data-label="Unit Price">{formatPrice(tool.unit_price)}</td>
                <td data-label="Condition">{tool.condition || '—'}</td>
                <td data-label="Location">{tool.storage_location || '—'}</td>
                <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" title="View" aria-label={`View ${tool.name}`} onClick={() => onView(tool)}>👁</button>
                  <button className="icon-btn" title="Edit" aria-label={`Edit ${tool.name}`} onClick={() => onEdit(tool)}>✎</button>
                  <button className="icon-btn danger" title="Delete" aria-label={`Delete ${tool.name}`} onClick={() => onDelete(tool)}>🗑</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
