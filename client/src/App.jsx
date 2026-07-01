import { useEffect, useState } from 'react';
import { carsApi, partsApi, statsApi, partsExportUrl } from './api.js';
import CarList from './components/CarList.jsx';
import PartsPanel from './components/PartsPanel.jsx';
import Modal from './components/Modal.jsx';
import CarForm from './components/CarForm.jsx';
import BarcodeScanner from './components/BarcodeScanner.jsx';
import GlobalSearchResults from './components/GlobalSearchResults.jsx';
import StatsBar from './components/StatsBar.jsx';
import LowStockView from './components/LowStockView.jsx';
import { CarListSkeleton } from './components/Skeleton.jsx';
import { useToast } from './components/ToastProvider.jsx';
import { useConfirm } from './components/ConfirmProvider.jsx';
import { LOW_STOCK_THRESHOLD } from './constants.js';

export default function App() {
  const toast = useToast();
  const confirm = useConfirm();
  const [cars, setCars] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  // Dashboard summary stats.
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Cross-car low-stock view.
  const [lowStockView, setLowStockView] = useState(false);
  const [lowStockResults, setLowStockResults] = useState([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);

  // Global (cross-car) search state.
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalResults, setGlobalResults] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalScan, setGlobalScan] = useState(false);

  // `silent` refreshes the list without flashing the skeleton — used when part
  // edits change a car's counts/value and the sidebar should update in place.
  async function loadCars(selectId, { silent = false } = {}) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await carsApi.list();
      setCars(data);
      // Keep the current selection in sync, or select a sensible default.
      const keepId = selectId ?? selected?.id;
      const next = data.find((c) => c.id === keepId) || null;
      setSelected(next);
    } catch (err) {
      setError(err.message);
      toast.error(`Couldn't load cars: ${err.message}`);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadStats() {
    try {
      setStats(await statsApi.get());
    } catch {
      // Non-critical: leave the last known stats in place.
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadLowStock() {
    setLowStockLoading(true);
    try {
      setLowStockResults(await partsApi.lowStock());
    } catch (err) {
      toast.error(`Couldn't load low-stock parts: ${err.message}`);
    } finally {
      setLowStockLoading(false);
    }
  }

  // Refresh dashboard-wide figures (sidebar counts/value + stats bar) after a
  // part changes inside a panel, without disturbing the current selection.
  function refreshDashboard() {
    loadCars(selected?.id, { silent: true });
    loadStats();
    if (lowStockView) loadLowStock();
  }

  function selectCar(car) {
    setLowStockView(false);
    setSelected(car);
  }

  function openLowStock() {
    setGlobalQuery('');
    setGlobalResults([]);
    setLowStockView(true);
    loadLowStock();
  }

  useEffect(() => {
    loadCars();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced cross-car search.
  useEffect(() => {
    const q = globalQuery.trim();
    if (!q) { setGlobalResults([]); return; }
    setGlobalLoading(true);
    const t = setTimeout(async () => {
      try {
        setGlobalResults(await partsApi.searchAll(q));
      } catch (err) {
        toast.error(`Search failed: ${err.message}`);
      } finally {
        setGlobalLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [globalQuery]);

  // Jump from a search result to the car it belongs to.
  function goToCar(part) {
    const car = cars.find((c) => c.id === part.car_id)
      || { id: part.car_id, make: part.car_make, model: part.car_model, year: part.car_year, nickname: part.car_nickname };
    setGlobalQuery('');
    setGlobalResults([]);
    setLowStockView(false);
    setSelected(car);
  }

  async function handleSubmit(data) {
    // Errors propagate to CarForm, which shows them inline; success toasts here.
    if (editing) {
      const updated = await carsApi.update(editing.id, data);
      await loadCars(updated.id);
      toast.success('Car updated');
    } else {
      const created = await carsApi.create(data);
      await loadCars(created.id);
      toast.success('Car added');
    }
    loadStats();
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete(car) {
    const ok = await confirm({
      title: 'Delete car?',
      message: `Delete ${car.year} ${car.make} ${car.model}? This also removes all of its parts. This can't be undone.`,
      confirmLabel: 'Delete car',
      danger: true,
    });
    if (!ok) return;
    try {
      await carsApi.remove(car.id);
      if (selected?.id === car.id) setSelected(null);
      await loadCars(selected?.id === car.id ? null : selected?.id);
      loadStats();
      toast.success(`Deleted ${car.year} ${car.make} ${car.model}`);
    } catch (err) {
      setError(err.message);
      toast.error(`Couldn't delete car: ${err.message}`);
    }
  }

  const openAddCar = () => { setEditing(null); setShowForm(true); };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden>🚗</span>
            <div className="brand-text">
              <h1>Car Parts Inventory</h1>
              <p className="brand-tagline">Track parts, stock and barcodes across your garage</p>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard">
        <StatsBar stats={stats} loading={statsLoading} onShowLowStock={openLowStock} />
        {(stats?.total_parts ?? 0) > 0 && (
          <div className="dashboard-actions">
            <a className="btn btn-secondary" href={partsExportUrl()} download title="Export every part across all cars to CSV">
              ⬇ Export all parts (CSV)
            </a>
          </div>
        )}
      </div>

      <div className="layout">
        <aside className="sidebar">
          <div className="global-search">
            <label className="small muted">Find a part across all cars</label>
            <div className="input-with-btn">
              <input
                className="search"
                placeholder="Name, part # or barcode…"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
              />
              <button className="btn btn-secondary" onClick={() => setGlobalScan(true)} title="Scan a barcode to find a part" aria-label="Scan a barcode to find a part">
                📷
              </button>
              {globalQuery && (
                <button className="btn btn-secondary" onClick={() => setGlobalQuery('')} title="Clear search" aria-label="Clear search">×</button>
              )}
            </div>
          </div>

          <div className="sidebar-header">
            <h2>Cars</h2>
            <button className="btn btn-primary" onClick={openAddCar}>
              + Add Car
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          {loading ? (
            <CarListSkeleton />
          ) : (
            <CarList
              cars={cars}
              selectedId={lowStockView ? null : selected?.id}
              onSelect={selectCar}
              onAdd={openAddCar}
              onEdit={(car) => { setEditing(car); setShowForm(true); }}
              onDelete={handleDelete}
            />
          )}
        </aside>

        <main className="content">
          {lowStockView ? (
            <LowStockView
              results={lowStockResults}
              loading={lowStockLoading}
              threshold={LOW_STOCK_THRESHOLD}
              onGoToCar={goToCar}
              onBack={() => setLowStockView(false)}
            />
          ) : globalQuery.trim() ? (
            <GlobalSearchResults
              query={globalQuery.trim()}
              results={globalResults}
              loading={globalLoading}
              onGoToCar={goToCar}
            />
          ) : selected ? (
            <PartsPanel key={selected.id} car={selected} onChanged={refreshDashboard} />
          ) : (
            <div className="empty-state">
              <div className="empty-emoji" aria-hidden>🚘</div>
              <div>
                <h3 className="empty-title">No car selected</h3>
                <p>Pick a car from the list to view its parts, or add a new one to get started.</p>
              </div>
              <button className="btn btn-primary" onClick={openAddCar}>+ Add Car</button>
            </div>
          )}
        </main>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Car' : 'Add Car'}
          onClose={() => { setShowForm(false); setEditing(null); }}
        >
          <CarForm
            initial={editing}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </Modal>
      )}

      {globalScan && (
        <Modal title="Scan to find a part" onClose={() => setGlobalScan(false)}>
          <BarcodeScanner
            onScan={(value) => { setGlobalScan(false); setGlobalQuery(value); }}
            onCancel={() => setGlobalScan(false)}
          />
        </Modal>
      )}
    </div>
  );
}
