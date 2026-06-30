import { useEffect, useMemo, useState } from 'react';
import { partsApi } from '../api.js';
import PartsTable from './PartsTable.jsx';
import Modal from './Modal.jsx';
import PartForm from './PartForm.jsx';
import PartDetail from './PartDetail.jsx';
import BarcodeScanner from './BarcodeScanner.jsx';
import { PartsTableSkeleton } from './Skeleton.jsx';
import { useToast } from './ToastProvider.jsx';
import { useConfirm } from './ConfirmProvider.jsx';
import { LOW_STOCK_THRESHOLD } from '../constants.js';

export default function PartsPanel({ car }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('name');
  const [order, setOrder] = useState('asc');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [scanSearch, setScanSearch] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await partsApi.list({
        car_id: car.id,
        category: category || undefined,
        search: search || undefined,
        sort,
        order,
      });
      setParts(data);
    } catch (err) {
      setError(err.message);
      toast.error(`Couldn't load parts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Reload whenever the car or any server-side filter/sort changes.
  // A small debounce keeps the search box responsive.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car.id, category, search, sort, order]);

  // Category options derived from the currently loaded parts.
  const categories = useMemo(() => {
    const set = new Set(parts.map((p) => p.category).filter(Boolean));
    return [...set].sort();
  }, [parts]);

  const lowStockCount = parts.filter((p) => p.quantity <= LOW_STOCK_THRESHOLD).length;
  const isFiltered = Boolean(search || category);

  function handleSort(key) {
    if (sort === key) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(key);
      setOrder('asc');
    }
  }

  async function handleSubmit(data) {
    // Errors propagate to PartForm (shown inline); success toasts here.
    const wasEditing = Boolean(editing);
    if (editing) {
      await partsApi.update(editing.id, data);
    } else {
      await partsApi.create(data);
    }
    setShowForm(false);
    setEditing(null);
    load();
    toast.success(wasEditing ? 'Part updated' : 'Part added');
  }

  // Inline +/- quantity change: update the UI immediately, persist via PATCH,
  // and reconcile (or roll back) with the server's response.
  async function handleAdjustQuantity(part, delta) {
    const newQty = Math.max(0, part.quantity + delta);
    if (newQty === part.quantity) return;

    const prev = parts;
    setParts((list) => list.map((p) => (p.id === part.id ? { ...p, quantity: newQty } : p)));
    try {
      const updated = await partsApi.patch(part.id, { quantity: newQty });
      setParts((list) => list.map((p) => (p.id === part.id ? updated : p)));
    } catch (err) {
      setParts(prev); // roll back optimistic change
      toast.error(`Couldn't update quantity: ${err.message}`);
    }
  }

  async function handleDelete(part) {
    const ok = await confirm({
      title: 'Delete part?',
      message: `Delete “${part.name}”? This can't be undone.`,
      confirmLabel: 'Delete part',
      danger: true,
    });
    if (!ok) return;
    try {
      await partsApi.remove(part.id);
      load();
      toast.success(`Deleted “${part.name}”`);
    } catch (err) {
      toast.error(`Couldn't delete part: ${err.message}`);
    }
  }

  // From the add form: a part with the scanned barcode already exists —
  // switch to editing it instead of creating a duplicate.
  function handleExistingPart(part) {
    setEditing(part);
    setShowForm(true);
  }

  return (
    <section className="parts-panel">
      <div className="panel-header">
        <div>
          <h2>{car.year} {car.make} {car.model}</h2>
          <p className="muted small">
            {parts.length} part{parts.length === 1 ? '' : 's'}
            {lowStockCount > 0 && (
              <span className="low-stock-summary"> · {lowStockCount} low stock</span>
            )}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          + Add Part
        </button>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, part # or barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={() => setScanSearch(true)} title="Scan a barcode to search">
          📷 Scan
        </button>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={`${sort}:${order}`} onChange={(e) => {
          const [s, o] = e.target.value.split(':');
          setSort(s); setOrder(o);
        }}>
          <option value="name:asc">Name (A–Z)</option>
          <option value="name:desc">Name (Z–A)</option>
          <option value="quantity:asc">Quantity (low→high)</option>
          <option value="quantity:desc">Quantity (high→low)</option>
          <option value="price:asc">Price (low→high)</option>
          <option value="price:desc">Price (high→low)</option>
        </select>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading ? (
        <PartsTableSkeleton />
      ) : parts.length === 0 ? (
        isFiltered ? (
          <div className="empty-state">
            <div className="empty-emoji" aria-hidden>🔍</div>
            <p>No parts match your search or filters.</p>
            <button className="btn btn-secondary" onClick={() => { setSearch(''); setCategory(''); }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-emoji" aria-hidden>📦</div>
            <p>No parts for this car yet — add your first part.</p>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
              + Add Part
            </button>
          </div>
        )
      ) : (
        <PartsTable
          parts={parts}
          sort={sort}
          order={order}
          onSort={handleSort}
          onView={setViewing}
          onEdit={(p) => { setEditing(p); setShowForm(true); }}
          onDelete={handleDelete}
          onAdjustQuantity={handleAdjustQuantity}
        />
      )}

      {showForm && (
        <Modal
          title={editing ? 'Edit Part' : 'Add Part'}
          onClose={() => { setShowForm(false); setEditing(null); }}
        >
          <PartForm
            initial={editing}
            carId={car.id}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            onExistingPart={handleExistingPart}
          />
        </Modal>
      )}

      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)}>
          <PartDetail part={viewing} />
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>
            <button className="btn btn-primary" onClick={() => { setEditing(viewing); setViewing(null); setShowForm(true); }}>
              Edit
            </button>
          </div>
        </Modal>
      )}

      {scanSearch && (
        <Modal title="Scan to search" onClose={() => setScanSearch(false)}>
          <BarcodeScanner
            onScan={(value) => { setScanSearch(false); setSearch(value); }}
            onCancel={() => setScanSearch(false)}
          />
        </Modal>
      )}
    </section>
  );
}
