-- Car parts inventory schema
-- Run with: psql "$DATABASE_URL" -f schema.sql

CREATE TABLE IF NOT EXISTS cars (
    id          SERIAL PRIMARY KEY,
    make        TEXT NOT NULL,
    model       TEXT NOT NULL,
    year        INTEGER NOT NULL CHECK (year >= 1885 AND year <= 2100),
    vin         TEXT UNIQUE,
    nickname    TEXT,
    photo_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parts (
    id               SERIAL PRIMARY KEY,
    car_id           INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    part_number      TEXT,
    category         TEXT,
    brand            TEXT,
    quantity         INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_price       NUMERIC(10, 2) CHECK (unit_price >= 0),
    storage_location TEXT,
    condition        TEXT CHECK (condition IN ('new', 'used', 'refurbished')),
    notes            TEXT,
    purchase_date    DATE,
    photo_url        TEXT,
    barcode          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parts_car_id      ON parts(car_id);
CREATE INDEX IF NOT EXISTS idx_parts_category    ON parts(category);
CREATE INDEX IF NOT EXISTS idx_parts_name        ON parts(name);
CREATE INDEX IF NOT EXISTS idx_parts_part_number ON parts(part_number);
CREATE INDEX IF NOT EXISTS idx_parts_barcode     ON parts(barcode);

-- ---------------------------------------------------------------------------
-- MIGRATION NOTE
-- ---------------------------------------------------------------------------
-- The CREATE TABLE statements above use "IF NOT EXISTS", so they will NOT add
-- newer columns to a database created before those columns existed. For an
-- existing database, run the following once:
--
--   ALTER TABLE parts ADD COLUMN IF NOT EXISTS photo_url TEXT;
--   ALTER TABLE parts ADD COLUMN IF NOT EXISTS barcode   TEXT;
--   CREATE INDEX IF NOT EXISTS idx_parts_barcode ON parts(barcode);
--   ALTER TABLE cars  ADD COLUMN IF NOT EXISTS photo_url TEXT;
--
-- (These statements are idempotent and safe to run on a fresh database too.)
-- ---------------------------------------------------------------------------
ALTER TABLE parts ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS barcode   TEXT;
ALTER TABLE cars  ADD COLUMN IF NOT EXISTS photo_url TEXT;
