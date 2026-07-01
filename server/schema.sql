-- Car parts inventory schema
-- Run with: psql "$DATABASE_URL" -f schema.sql

-- Users (self-hosted authentication). Passwords are ALWAYS stored as a bcrypt
-- hash in password_hash — never in plaintext.
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session store for express-session / connect-pg-simple.
-- Declared with sid as the PRIMARY KEY inline so this stays idempotent
-- (no separate ADD CONSTRAINT, which would fail on re-run).
CREATE TABLE IF NOT EXISTS "session" (
    "sid"    varchar NOT NULL PRIMARY KEY,
    "sess"   json NOT NULL,
    "expire" timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

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

-- Tools inventory — an inventory of tools you own, parallel to parts but not
-- tied to a specific car.
CREATE TABLE IF NOT EXISTS tools (
    id               SERIAL PRIMARY KEY,
    name             TEXT NOT NULL,
    brand            TEXT,
    category         TEXT,
    quantity         INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    condition        TEXT CHECK (condition IN ('new', 'used')),
    storage_location TEXT,
    purchase_date    DATE,
    unit_price       NUMERIC(10, 2) CHECK (unit_price >= 0),
    barcode          TEXT,
    photo_url        TEXT,
    notes            TEXT,
    user_id          INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_name     ON tools(name);
CREATE INDEX IF NOT EXISTS idx_tools_barcode  ON tools(barcode);

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
-- Forward-compat: a nullable user_id (no FK yet, defaults NULL) is added to
-- cars, parts and tools so a future multi-user feature won't require reshaping
-- existing rows. It is intentionally left unused for now.
--
-- (These statements are idempotent and safe to run on a fresh database too.)
-- ---------------------------------------------------------------------------
ALTER TABLE parts ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS barcode   TEXT;
ALTER TABLE cars  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Forward-compat multi-user column (nullable, no FK, unused for now).
ALTER TABLE cars  ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS user_id INTEGER;
