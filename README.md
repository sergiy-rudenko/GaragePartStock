# Car Parts Inventory

A full-stack web app to manage a car parts inventory. Track your vehicles and the
parts associated with each one, with search, filtering, sorting, and low-stock alerts.

- **Frontend:** React + Vite + axios + [@zxing/browser](https://github.com/zxing-js/browser) (barcode/QR scanning)
- **Backend:** Node.js + Express (ES modules) + [multer](https://github.com/expressjs/multer) (image uploads)
- **Database:** PostgreSQL (via `pg` connection pool)

```text
.
├── server/        Express API, routes, db connection, schema.sql, .env.example, uploads/
├── client/        React app (Vite)
└── README.md
```

## Features

- Dashboard listing all cars (with per-car part counts, **total inventory value**,
  and a low-stock chip); click a car to view its parts.
- **Summary stats bar** — total cars, total parts, total inventory value
  (Σ quantity × unit price), and low-stock count across the whole inventory.
- **Low-stock view** — one click (on the low-stock stat) lists every part at or
  below the threshold across all cars, each with a jump-to-car link.
- **CSV export / import** — export a single car's parts or every part to CSV, and
  bulk-add parts to a car by uploading a CSV with an in-browser validation preview.
- **Category suggestions** — the part form suggests existing categories as you type.
- **Table density toggle** — switch the parts table between comfortable and compact
  rows; the choice (plus sort/order) persists across car switches for the session.
- Full CRUD for **cars** and **parts** via modal forms.
- Parts table with **search** (name / part number), **category filter**, and
  **sorting** by name, quantity, or price.
- **Low-stock indicator** when a part's quantity is at or below the threshold
  (default `5`, configurable in `client/src/constants.js`).
- **Part & car photos** — upload an image file **or** capture one from the device
  camera (live preview via `getUserMedia`), using the same photo control on both the
  part and car forms. Part thumbnails appear in the table (full size in the part detail
  view); car thumbnails appear in the Cars sidebar, falling back to a car icon when
  there's no photo. Images are stored under `server/uploads/` and served at `/uploads`.
- **Barcode / QR scanning** — scan a part's barcode live with the device camera
  (`@zxing/browser`). Scan to auto-fill the barcode field, scan to search the table,
  and on the add form a scan that matches an existing barcode surfaces that part
  instead of creating a duplicate.
- **Product auto-fill** — a scanned/typed barcode is looked up against an external
  product database (UPCitemdb by default, configurable) to pre-fill name, brand,
  category, and photo. Local duplicates are checked first; provider errors and rate
  limits fall back to manual entry without blocking the form. Any product image is
  **downloaded into `server/uploads/` at save time** (not hot-linked), with a graceful
  fall back to no image. See [Barcode lookup](#barcode-lookup--product-auto-fill).
- **Inline quantity adjustment** — `+`/`−` buttons in the parts table change a part's
  quantity via `PATCH` without opening the edit form; the UI updates optimistically
  and the low-stock indicator refreshes immediately.
- **Global search** — find a part across **all** cars by name, part number, or barcode
  (with a scan-to-find button) — ideal for locating an item by its barcode regardless
  of which car it's filed under. Results show the owning car with a jump-to link.
- Clean, responsive UI — cohesive palette, soft card shadows, rounded corners, and a
  clear typographic hierarchy across the dashboard, tables, and modal forms. On phones
  the parts table reflows into stacked cards.
- **Loading & empty states** — shimmer skeletons while cars/parts load, and friendly
  empty states ("No cars yet — add your first", "No parts for this car yet").
- **Toast notifications** — non-blocking toasts for successes and failures (part saved,
  car deleted, lookup/search failed, …) instead of silent or blocking feedback.
- **Confirm dialogs** — a styled confirm replaces the browser default for destructive
  actions; deleting a car warns that it also removes all its parts.
- **Inline form validation** — field-level errors (required name, valid year, etc.),
  with Save disabled and a "Saving…" state while submitting.
- **Keyboard & accessibility** — Esc closes modals/lightbox, Enter submits forms, focus
  moves to the first field on open, and icon-only buttons carry aria-labels.
- **Image lightbox** — click any part or car thumbnail to view the full-size photo in an
  overlay; missing image files degrade gracefully to a placeholder icon.

> **Camera note:** browsers only grant `getUserMedia` (camera) access over
> **`https://` or `http://localhost`**. The Vite dev server on `localhost` works
> out of the box; if you access the app from another device by IP, serve it over
> HTTPS or the camera features will be blocked by the browser.

---

## Prerequisites

- **Node.js 18+** (uses native `--watch` and ES modules)
- **PostgreSQL 13+** running locally or reachable via a connection string

---

## 1. Database setup

Create a database (named `car_parts` here, but any name works):

```bash
createdb car_parts
# or, from psql:  CREATE DATABASE car_parts;
```

---

## 2. Backend setup (`/server`)

```bash
cd server
npm install

# Configure environment
cp .env.example .env
# Edit .env and set DATABASE_URL to point at your database, e.g.
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/car_parts

# Create the tables (reads schema.sql and applies it).
# schema.sql is idempotent — it is also the migration: it ADDs newer columns
# (parts.photo_url, parts.barcode, cars.photo_url) to a pre-existing database,
# so re-running init-db on an older database safely upgrades it.
npm run init-db
# -- or apply the SQL directly --
# psql "$DATABASE_URL" -f schema.sql

# Start the API (http://localhost:4000)
npm run dev      # auto-reload on changes
# or
npm start
```

Verify it's up:

```bash
curl http://localhost:4000/api/health
# {"status":"ok"}
```

### Environment variables (`server/.env`)

| Variable                  | Description                                                  | Default                                          |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| `DATABASE_URL`            | PostgreSQL connection string (**required**)                  | —                                                |
| `PORT`                    | Port the Express server listens on                           | `4000`                                           |
| `CORS_ORIGIN`             | Comma-separated allowed frontend origin(s)                   | `http://localhost:5173`                          |
| `LOW_STOCK_THRESHOLD`     | Quantity at/below which a part counts as low stock (optional) | `5`                                             |
| `BARCODE_LOOKUP_PROVIDER` | Provider name shown in the UI ("Auto-filled from …")         | `UPCitemdb`                                       |
| `BARCODE_LOOKUP_URL`      | Lookup endpoint (UPC passed as `?upc=`)                      | `https://api.upcitemdb.com/prod/trial/lookup`    |
| `BARCODE_LOOKUP_API_KEY`  | API key; blank uses the free trial (sent as `user_key`)      | _(blank)_                                        |
| `BARCODE_LOOKUP_ENABLED`  | Set `false` to disable external lookups (local check stays)  | `true`                                           |

#### Barcode lookup / product auto-fill

When a barcode is scanned or typed on the **Add Part** form, the backend resolves it:

1. **Local DB** — if a part already has that barcode, it's returned so you can
   open it instead of creating a duplicate (no external call is made).
2. **External provider** — otherwise the barcode is looked up via
   `BARCODE_LOOKUP_URL` and any `name`, `brand`, `category`, and product image
   are used to pre-fill empty fields.
3. **No match** — fields are left blank for manual entry.

The default provider is [UPCitemdb](https://www.upcitemdb.com/). Its **free trial
endpoint needs no API key** but is shared and rate-limited (~100 requests/day);
on a rate-limit or any provider error the form is **never blocked** — it simply
falls back to manual entry. For higher limits, set `BARCODE_LOOKUP_URL` to the
paid endpoint (`https://api.upcitemdb.com/prod/v1/lookup`) and add your
`BARCODE_LOOKUP_API_KEY`. The API key stays on the server and is never exposed
to the browser.

---

## 3. Frontend setup (`/client`)

```bash
cd client
npm install
npm run dev      # http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to `http://localhost:4000`, so no
extra configuration is needed in development. To point the frontend at a different
API URL (e.g. in production), copy `.env.example` to `.env` and set
`VITE_API_BASE_URL`.

Open <http://localhost:5173> in your browser.

---

## API reference

Base URL: `http://localhost:4000/api`

### Cars

| Method | Path         | Description                          |
| ------ | ------------ | ------------------------------------ |
| GET    | `/cars`      | List all cars (with `part_count`)    |
| GET    | `/cars/:id`  | Get one car                          |
| POST   | `/cars`      | Create a car                         |
| PUT    | `/cars/:id`  | Update a car                         |
| DELETE | `/cars/:id`  | Delete a car (**cascades to parts**) |

`GET /cars` augments each car with `part_count`, `total_value`
(Σ quantity × unit price), and `low_stock_count`.

**Car body:** `make*`, `model*`, `year*`, `vin`, `nickname`, `photo_url` (`*` required).
A remote `photo_url` (e.g. an image URL) is downloaded into `server/uploads/` at save
time and replaced with the local path, exactly like parts.

### Parts

| Method | Path             | Description                                       |
| ------ | ---------------- | ------------------------------------------------- |
| GET    | `/parts`            | List parts for a car (see below)                  |
| GET    | `/parts/search`     | Cross-car search by name/part #/barcode (`?q=`)   |
| GET    | `/parts/low-stock`  | All parts at/below the low-stock threshold        |
| GET    | `/parts/categories` | Distinct existing categories (for suggestions)    |
| GET    | `/parts/export`     | CSV export (`?car_id=` for one car, else all)     |
| POST   | `/parts/import`     | Bulk-add parts to a car from parsed rows          |
| GET    | `/parts/:id`        | Get one part                                      |
| POST   | `/parts`            | Create a part                                     |
| PUT    | `/parts/:id`        | Update a part (partial merge)                     |
| PATCH  | `/parts/:id`        | Partial update (e.g. inline quantity change)      |
| DELETE | `/parts/:id`        | Delete a part                                     |
| POST   | `/parts/upload`     | Upload an image (`multipart/form-data`)           |

`GET /parts/low-stock` returns parts whose `quantity` ≤ the low-stock threshold
(default `5`), each augmented with `car_make`, `car_model`, `car_year`, and
`car_nickname`, ordered by quantity ascending.

`GET /parts/export` streams `text/csv` (with a `Content-Disposition` filename).
With `?car_id=<id>` it exports that car's parts; with no `car_id` it exports every
part, prefixed with the owning car's `car_year`/`car_make`/`car_model`/`car_nickname`.
The CSV header names match the importable fields below.

`POST /parts/import` accepts `{ "car_id": <id>, "parts": [ { "name": "...", ... } ] }`.
Every row is validated first (same rules as `POST /parts`); if any row is invalid
**nothing** is inserted and the response is `400` with
`{ "error": "...", "details": [ { "row": <n>, "error": "..." } ] }`. On success all
rows are inserted in a single transaction and the response is
`{ "created": <count> }`. Importable fields: `name*`, `part_number`, `category`,
`brand`, `quantity`, `unit_price`, `storage_location`, `condition`, `purchase_date`,
`barcode`, `notes` (`*` required; unknown columns are ignored). Max 1000 rows per call.

`GET /parts/search?q=` returns matching parts across all cars, each augmented with
`car_make`, `car_model`, `car_year`, and `car_nickname`.

When a part is created or updated with a `photo_url` that is a remote `http(s)` URL
(e.g. from a barcode lookup), the server downloads the image into `server/uploads/`
and stores the local path instead. If the download fails, `photo_url` is set to `null`.

**`GET /parts` query parameters:**

- `car_id` — filter to a single car
- `category` — filter by exact category
- `barcode` — filter by exact barcode (used for duplicate detection)
- `search` — case-insensitive match on `name`, `part_number` **or** `barcode`
- `sort` — `name` | `quantity` | `price` | `created_at` (default `created_at`)
- `order` — `asc` | `desc` (default `desc`)

**`POST /parts/upload`** accepts a single image under the form field `photo`
(max 8 MB, `image/*` only) and returns `{ "photo_url": "/uploads/<file>" }`.
Store that value in the part's `photo_url`. Images are served at
`GET /uploads/<file>`.

**Part body:** `car_id*`, `name*`, `part_number`, `category`, `brand`,
`quantity` (int ≥ 0), `unit_price` (≥ 0), `storage_location`,
`condition` (`new` | `used` | `refurbished`), `notes`, `purchase_date` (`YYYY-MM-DD`),
`photo_url`, `barcode`.

### Stats

| Method | Path      | Description                          |
| ------ | --------- | ------------------------------------ |
| GET    | `/stats`  | Inventory-wide summary figures       |

Returns `{ total_cars, total_parts, total_value, low_stock_count, low_stock_threshold }`.
The low-stock threshold defaults to `5` and can be overridden without touching
`.env` via the optional `LOW_STOCK_THRESHOLD` environment variable
(see `server/src/constants.js`); it mirrors the client default in
`client/src/constants.js`.

### Barcode lookup

| Method | Path                | Description                                |
| ------ | ------------------- | ------------------------------------------ |
| GET    | `/lookup/:barcode`  | Resolve a barcode (local → external → none) |

Always responds `200` with one of:

```jsonc
{ "match": "local",    "part": { /* existing part with this barcode */ } }
{ "match": "external", "source": "UPCitemdb",
  "product": { "name": "...", "brand": "...", "category": "...", "image_url": "..." } }
{ "match": "none",     "warning": "Barcode lookup rate limit reached — try again later." }
```

`warning` is present only when the external provider errored or was rate-limited;
the client treats `none` (with or without a warning) as "fill in manually".

### Error responses

All errors return JSON shaped as `{ "error": "message" }` with an appropriate
status code (`400` validation, `404` not found, `409` conflict, `500` server error).

### Example

```bash
# Create a car
curl -X POST http://localhost:4000/api/cars \
  -H 'Content-Type: application/json' \
  -d '{"make":"Toyota","model":"Supra","year":1998,"nickname":"Project car"}'

# Add a part to car 1
curl -X POST http://localhost:4000/api/parts \
  -H 'Content-Type: application/json' \
  -d '{"car_id":1,"name":"Turbocharger","category":"Engine","quantity":2,"unit_price":850.00,"condition":"used"}'

# Search parts for car 1
curl "http://localhost:4000/api/parts?car_id=1&search=turbo&sort=price&order=desc"

# Resolve a barcode (local DB first, then the external product database)
curl "http://localhost:4000/api/lookup/4002293401102"

# Bump a part's quantity inline (PATCH)
curl -X PATCH http://localhost:4000/api/parts/1 \
  -H 'Content-Type: application/json' -d '{"quantity":12}'

# Find a part across ALL cars (by name, part number, or barcode)
curl "http://localhost:4000/api/parts/search?q=012345678905"
```

---

## Data model

**cars:** `id`, `make`, `model`, `year`, `vin` (unique), `nickname`, `photo_url`, `created_at`

**parts:** `id`, `car_id` (FK → `cars.id`, `ON DELETE CASCADE`), `name`,
`part_number`, `category`, `brand`, `quantity`, `unit_price`, `storage_location`,
`condition`, `notes`, `purchase_date`, `photo_url`, `barcode`, `created_at`

See [`server/schema.sql`](server/schema.sql) for the full DDL.
