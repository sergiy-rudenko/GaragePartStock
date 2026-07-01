import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

// withCredentials so the session cookie is always sent/stored, including when
// the API is on a different origin (production). In dev, Vite proxies /api so
// requests are same-origin anyway.
const client = axios.create({ baseURL, withCredentials: true });

// When any authenticated request comes back 401 (e.g. the session expired), let
// the app drop back to the login screen. Auth endpoints handle their own 401s.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !/\/auth\/(login|signup|me)/.test(url)) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(err);
  }
);

// Normalize error messages from the API into thrown Errors.
function unwrap(promise) {
  return promise.then((res) => res.data).catch((err) => {
    const message = err.response?.data?.error || err.message || 'Request failed';
    throw new Error(message);
  });
}

export const authApi = {
  // Current user, or throws (401) when not logged in.
  me: () => unwrap(client.get('/auth/me')),
  signup: (email, password) => unwrap(client.post('/auth/signup', { email, password })),
  login: (email, password) => unwrap(client.post('/auth/login', { email, password })),
  logout: () => unwrap(client.post('/auth/logout')),
};

export const carsApi = {
  list: () => unwrap(client.get('/cars')),
  get: (id) => unwrap(client.get(`/cars/${id}`)),
  create: (data) => unwrap(client.post('/cars', data)),
  update: (id, data) => unwrap(client.put(`/cars/${id}`, data)),
  remove: (id) => unwrap(client.delete(`/cars/${id}`)),
};

export const statsApi = {
  // Dashboard summary: { total_cars, total_parts, total_value, low_stock_count, low_stock_threshold }.
  get: () => unwrap(client.get('/stats')),
};

export const partsApi = {
  list: (params) => unwrap(client.get('/parts', { params })),
  create: (data) => unwrap(client.post('/parts', data)),
  update: (id, data) => unwrap(client.put(`/parts/${id}`, data)),
  patch: (id, data) => unwrap(client.patch(`/parts/${id}`, data)),
  remove: (id) => unwrap(client.delete(`/parts/${id}`)),

  // Global search across ALL cars; each result includes car_* fields.
  searchAll: (q) => unwrap(client.get('/parts/search', { params: { q } })),

  // Every part across all cars at/below the low-stock threshold (with car_* fields).
  lowStock: () => unwrap(client.get('/parts/low-stock')),

  // Distinct existing categories, for type-ahead suggestions.
  categories: () => unwrap(client.get('/parts/categories')),

  // Bulk-add pre-parsed rows to a car. Resolves to { created } or throws with
  // per-row details on validation failure.
  importParts: (carId, parts) => unwrap(client.post('/parts/import', { car_id: carId, parts })),

  // Upload an image File; returns { photo_url }.
  uploadPhoto: (file) => {
    const fd = new FormData();
    fd.append('photo', file);
    return unwrap(client.post('/parts/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },

  // Find the first part matching an exact barcode, or null.
  findByBarcode: (barcode) =>
    unwrap(client.get('/parts', { params: { barcode } })).then((rows) => rows[0] || null),
};

export const toolsApi = {
  list: (params) => unwrap(client.get('/tools', { params })),
  get: (id) => unwrap(client.get(`/tools/${id}`)),
  create: (data) => unwrap(client.post('/tools', data)),
  update: (id, data) => unwrap(client.put(`/tools/${id}`, data)),
  patch: (id, data) => unwrap(client.patch(`/tools/${id}`, data)),
  remove: (id) => unwrap(client.delete(`/tools/${id}`)),

  // Search tools by name, brand or barcode.
  search: (q) => unwrap(client.get('/tools/search', { params: { q } })),

  // Distinct existing tool categories, for type-ahead suggestions.
  categories: () => unwrap(client.get('/tools/categories')),

  // Upload an image File; returns { photo_url }.
  uploadPhoto: (file) => {
    const fd = new FormData();
    fd.append('photo', file);
    return unwrap(client.post('/tools/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },
};

export const lookupApi = {
  // Resolve a barcode: local DB match, external provider match, or none.
  byBarcode: (barcode) => unwrap(client.get(`/lookup/${encodeURIComponent(barcode)}`)),
};

// Resolve a stored asset path (e.g. "/uploads/x.jpg") into a usable URL.
// In dev, relative paths are proxied by Vite. If the API base is absolute,
// the asset is served from that same origin.
export function assetUrl(p) {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  if (/^https?:\/\//i.test(baseURL)) {
    try {
      return new URL(p, baseURL).origin + p;
    } catch {
      return p;
    }
  }
  return p;
}

// Build the URL for the CSV export endpoint. Pass a carId to export one car's
// parts, or omit it to export every part across all cars. Used as an <a href>
// so the browser downloads the file directly.
export function partsExportUrl(carId) {
  const qs = carId ? `?car_id=${encodeURIComponent(carId)}` : '';
  return `${baseURL}/parts/export${qs}`;
}
