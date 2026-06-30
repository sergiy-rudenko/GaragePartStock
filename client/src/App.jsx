import { useEffect, useState } from 'react';
import { carsApi, partsApi } from './api.js';
import CarList from './components/CarList.jsx';
import PartsPanel from './components/PartsPanel.jsx';
import Modal from './components/Modal.jsx';
import CarForm from './components/CarForm.jsx';
import BarcodeScanner from './components/BarcodeScanner.jsx';
import GlobalSearchResults from './components/GlobalSearchResults.jsx';

export default function App() {
  const [cars, setCars] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  // Global (cross-car) search state.
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalResults, setGlobalResults] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalScan, setGlobalScan] = useState(false);

  async function loadCars(selectId) {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCars();
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
        setError(err.message);
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
    setSelected(car);
  }

  async function handleSubmit(data) {
    if (editing) {
      const updated = await carsApi.update(editing.id, data);
      await loadCars(updated.id);
    } else {
      const created = await carsApi.create(data);
      await loadCars(created.id);
    }
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete(car) {
    if (!window.confirm(`Delete ${car.year} ${car.make} ${car.model} and all its parts?`)) return;
    try {
      await carsApi.remove(car.id);
      if (selected?.id === car.id) setSelected(null);
      await loadCars(selected?.id === car.id ? null : selected?.id);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚗 Car Parts Inventory</h1>
      </header>

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
              <button className="btn btn-secondary" onClick={() => setGlobalScan(true)} title="Scan a barcode to find a part">
                📷
              </button>
              {globalQuery && (
                <button className="btn btn-secondary" onClick={() => setGlobalQuery('')} title="Clear">×</button>
              )}
            </div>
          </div>

          <div className="sidebar-header">
            <h2>Cars</h2>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
              + Add Car
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          {loading ? (
            <p className="muted">Loading…</p>
          ) : (
            <CarList
              cars={cars}
              selectedId={selected?.id}
              onSelect={setSelected}
              onEdit={(car) => { setEditing(car); setShowForm(true); }}
              onDelete={handleDelete}
            />
          )}
        </aside>

        <main className="content">
          {globalQuery.trim() ? (
            <GlobalSearchResults
              query={globalQuery.trim()}
              results={globalResults}
              loading={globalLoading}
              onGoToCar={goToCar}
            />
          ) : selected ? (
            <PartsPanel key={selected.id} car={selected} />
          ) : (
            <div className="empty-state">
              <p>Select a car to view its parts, or add a new car to get started.</p>
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
