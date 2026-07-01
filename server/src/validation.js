// Lightweight validation helpers shared across routes.

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

export const VALID_CONDITIONS = ['new', 'used', 'refurbished'];
export const VALID_TOOL_CONDITIONS = ['new', 'used'];

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function toIntOrNull(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new ValidationError(`${field} must be an integer`);
  return n;
}

export function toNumberOrNull(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) throw new ValidationError(`${field} must be a number`);
  return n;
}

// Validates and normalizes a car payload. `partial` allows missing fields (for PATCH/PUT-merge).
export function validateCar(body, { partial = false } = {}) {
  const out = {};

  if (!partial || body.make !== undefined) {
    if (!isNonEmptyString(body.make)) throw new ValidationError('make is required');
    out.make = body.make.trim();
  }
  if (!partial || body.model !== undefined) {
    if (!isNonEmptyString(body.model)) throw new ValidationError('model is required');
    out.model = body.model.trim();
  }
  if (!partial || body.year !== undefined) {
    const year = toIntOrNull(body.year, 'year');
    if (year === null) throw new ValidationError('year is required');
    if (year < 1885 || year > 2100) throw new ValidationError('year must be between 1885 and 2100');
    out.year = year;
  }
  if (body.vin !== undefined) out.vin = isNonEmptyString(body.vin) ? body.vin.trim() : null;
  if (body.nickname !== undefined) out.nickname = isNonEmptyString(body.nickname) ? body.nickname.trim() : null;
  if (body.photo_url !== undefined) out.photo_url = isNonEmptyString(body.photo_url) ? body.photo_url.trim() : null;

  return out;
}

// Validates and normalizes a part payload.
export function validatePart(body, { partial = false } = {}) {
  const out = {};

  if (!partial || body.car_id !== undefined) {
    const carId = toIntOrNull(body.car_id, 'car_id');
    if (carId === null) throw new ValidationError('car_id is required');
    out.car_id = carId;
  }
  if (!partial || body.name !== undefined) {
    if (!isNonEmptyString(body.name)) throw new ValidationError('name is required');
    out.name = body.name.trim();
  }
  if (body.part_number !== undefined) out.part_number = isNonEmptyString(body.part_number) ? body.part_number.trim() : null;
  if (body.category !== undefined) out.category = isNonEmptyString(body.category) ? body.category.trim() : null;
  if (body.brand !== undefined) out.brand = isNonEmptyString(body.brand) ? body.brand.trim() : null;

  if (body.quantity !== undefined) {
    const q = toIntOrNull(body.quantity, 'quantity');
    if (q !== null && q < 0) throw new ValidationError('quantity must be >= 0');
    out.quantity = q ?? 0;
  }
  if (body.unit_price !== undefined) {
    const p = toNumberOrNull(body.unit_price, 'unit_price');
    if (p !== null && p < 0) throw new ValidationError('unit_price must be >= 0');
    out.unit_price = p;
  }
  if (body.storage_location !== undefined) out.storage_location = isNonEmptyString(body.storage_location) ? body.storage_location.trim() : null;
  if (body.condition !== undefined) {
    if (body.condition === null || body.condition === '') {
      out.condition = null;
    } else if (!VALID_CONDITIONS.includes(body.condition)) {
      throw new ValidationError(`condition must be one of: ${VALID_CONDITIONS.join(', ')}`);
    } else {
      out.condition = body.condition;
    }
  }
  if (body.notes !== undefined) out.notes = isNonEmptyString(body.notes) ? body.notes.trim() : null;
  if (body.purchase_date !== undefined) out.purchase_date = isNonEmptyString(body.purchase_date) ? body.purchase_date : null;
  if (body.photo_url !== undefined) out.photo_url = isNonEmptyString(body.photo_url) ? body.photo_url.trim() : null;
  if (body.barcode !== undefined) out.barcode = isNonEmptyString(body.barcode) ? body.barcode.trim() : null;

  return out;
}

// Validates and normalizes a tool payload. Mirrors validatePart but has no
// car_id or part_number, and condition is limited to new/used.
export function validateTool(body, { partial = false } = {}) {
  const out = {};

  if (!partial || body.name !== undefined) {
    if (!isNonEmptyString(body.name)) throw new ValidationError('name is required');
    out.name = body.name.trim();
  }
  if (body.brand !== undefined) out.brand = isNonEmptyString(body.brand) ? body.brand.trim() : null;
  if (body.category !== undefined) out.category = isNonEmptyString(body.category) ? body.category.trim() : null;

  if (body.quantity !== undefined) {
    const q = toIntOrNull(body.quantity, 'quantity');
    if (q !== null && q < 0) throw new ValidationError('quantity must be >= 0');
    out.quantity = q ?? 0;
  }
  if (body.unit_price !== undefined) {
    const p = toNumberOrNull(body.unit_price, 'unit_price');
    if (p !== null && p < 0) throw new ValidationError('unit_price must be >= 0');
    out.unit_price = p;
  }
  if (body.storage_location !== undefined) out.storage_location = isNonEmptyString(body.storage_location) ? body.storage_location.trim() : null;
  if (body.condition !== undefined) {
    if (body.condition === null || body.condition === '') {
      out.condition = null;
    } else if (!VALID_TOOL_CONDITIONS.includes(body.condition)) {
      throw new ValidationError(`condition must be one of: ${VALID_TOOL_CONDITIONS.join(', ')}`);
    } else {
      out.condition = body.condition;
    }
  }
  if (body.notes !== undefined) out.notes = isNonEmptyString(body.notes) ? body.notes.trim() : null;
  if (body.purchase_date !== undefined) out.purchase_date = isNonEmptyString(body.purchase_date) ? body.purchase_date : null;
  if (body.photo_url !== undefined) out.photo_url = isNonEmptyString(body.photo_url) ? body.photo_url.trim() : null;
  if (body.barcode !== undefined) out.barcode = isNonEmptyString(body.barcode) ? body.barcode.trim() : null;

  return out;
}
