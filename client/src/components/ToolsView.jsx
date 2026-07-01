import { useEffect, useMemo, useState } from 'react';
import { toolsApi } from '../api.js';
import ToolsTable from './ToolsTable.jsx';
import ToolForm from './ToolForm.jsx';
import ToolDetail from './ToolDetail.jsx';
import Modal from './Modal.jsx';
import BarcodeScanner from './BarcodeScanner.jsx';
import { PartsTableSkeleton } from './Skeleton.jsx';
import { useToast } from './ToastProvider.jsx';
import { useConfirm } from './ConfirmProvider.jsx';
import { LOW_STOCK_THRESHOLD } from '../constants.js';
import { getPref, setPref } from '../prefs.js';

// Standalone inventory of tools — parallel to PartsPanel but not tied to a car.
export default function ToolsView() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  // Reuse the shared sort/order/density prefs so the choice is consistent with parts.
  const [sort, setSort] = useState(() => getPref('sort'));
  const [order, setOrder] = useState(() => getPref('order'));
  const [density, setDensity] = useState(() => getPref('density'));

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [scanSearch, setScanSearch] = useState(false);
  const [categorySuggestions, setCategorySuggestions] = useState([]);

  function loadCategories() {
    toolsApi.categories().then(setCategorySuggestions).catch(() => {});
  }
  useEffect(loadCategories, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await toolsApi.list({
        category: category || undefined,
        search: search || undefined,
        sort,
        order,
      });
      setTools(data);
    } catch (err) {
      setError(err.message);
      toast.error(`Couldn't load tools: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Reload whenever a server-side filter/sort changes; debounced for the search box.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search, sort, order]);

  const categories = useMemo(() => {
    const set = new Set(tools.map((t) => t.category).filter(Boolean));
    return [...set].sort();
  }, [tools]);

  const lowStockCount = tools.filter((t) => t.quantity <= LOW_STOCK_THRESHOLD).length;
  const isFiltered = Boolean(search || category);

  function applySort(nextSort, nextOrder) {
    setSort(nextSort);
    setOrder(nextOrder);
    setPref('sort', nextSort);
    setPref('order', nextOrder);
  }

  function handleSort(key) {
    if (sort === key) {
      applySort(key, order === 'asc' ? 'desc' : 'asc');
    } else {
      applySort(key, 'asc');
    }
  }

  function toggleDensity() {
    const next = density === 'compact' ? 'comfortable' : 'compact';
    setDensity(next);
    setPref('density', next);
  }

  async function handleSubmit(data) {
    const wasEditing = Boolean(editing);
    if (editing) {
      await toolsApi.update(editing.id, data);
    } else {
      await toolsApi.create(data);
    }
    setShowForm(false);
    setEditing(null);
    load();
    loadCategories();
    toast.success(wasEditing ? 'Tool updated' : 'Tool added');
  }

  async function handleAdjustQuantity(tool, delta) {
    const newQty = Math.max(0, tool.quantity + delta);
    if (newQty === tool.quantity) return;

    const prev = tools;
    setTools((list) => list.map((t) => (t.id === tool.id ? { ...t, quantity: newQty } : t)));
    try {
      const updated = await toolsApi.patch(tool.id, { quantity: newQty });
      setTools((list) => list.map((t) => (t.id === tool.id ? updated : t)));
    } catch (err) {
      setTools(prev); // roll back optimistic change
      toast.error(`Couldn't update quantity: ${err.message}`);
    }
  }

  async function handleDelete(tool) {
    const ok = await confirm({
      title: 'Delete tool?',
      message: `Delete “${tool.name}”? This can't be undone.`,
      confirmLabel: 'Delete tool',
      danger: true,
    });
    if (!ok) return;
    try {
      await toolsApi.remove(tool.id);
      load();
      toast.success(`Deleted “${tool.name}”`);
    } catch (err) {
      toast.error(`Couldn't delete tool: ${err.message}`);
    }
  }

  return (
    <section className="parts-panel">
      <div className="panel-header">
        <div>
          <h2>Tools</h2>
          <p className="muted small">
            {tools.length} tool{tools.length === 1 ? '' : 's'}
            {lowStockCount > 0 && (
              <span className="low-stock-summary"> · {lowStockCount} low stock</span>
            )}
          </p>
        </div>
        <div className="panel-actions">
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            + Add Tool
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, brand or barcode…"
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
          applySort(s, o);
        }}>
          <option value="name:asc">Name (A–Z)</option>
          <option value="name:desc">Name (Z–A)</option>
          <option value="quantity:asc">Quantity (low→high)</option>
          <option value="quantity:desc">Quantity (high→low)</option>
          <option value="price:asc">Price (low→high)</option>
          <option value="price:desc">Price (high→low)</option>
        </select>
        <button
          className="btn btn-secondary"
          onClick={toggleDensity}
          aria-pressed={density === 'compact'}
          title={`Switch to ${density === 'compact' ? 'comfortable' : 'compact'} rows`}
        >
          {density === 'compact' ? '≣ Comfortable' : '≡ Compact'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading ? (
        <PartsTableSkeleton />
      ) : tools.length === 0 ? (
        isFiltered ? (
          <div className="empty-state">
            <div className="empty-emoji" aria-hidden>🔍</div>
            <p>No tools match your search or filters.</p>
            <button className="btn btn-secondary" onClick={() => { setSearch(''); setCategory(''); }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-emoji" aria-hidden>🛠</div>
            <div>
              <h3 className="empty-title">No tools yet</h3>
              <p>Add your first tool to start tracking your toolbox.</p>
            </div>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
              + Add Tool
            </button>
          </div>
        )
      ) : (
        <ToolsTable
          tools={tools}
          sort={sort}
          order={order}
          density={density}
          onSort={handleSort}
          onView={setViewing}
          onEdit={(t) => { setEditing(t); setShowForm(true); }}
          onDelete={handleDelete}
          onAdjustQuantity={handleAdjustQuantity}
        />
      )}

      {showForm && (
        <Modal
          title={editing ? 'Edit Tool' : 'Add Tool'}
          onClose={() => { setShowForm(false); setEditing(null); }}
        >
          <ToolForm
            initial={editing}
            categories={categorySuggestions}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </Modal>
      )}

      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)}>
          <ToolDetail tool={viewing} />
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
