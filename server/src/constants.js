// Shared server-side configuration. Env-free defaults; an optional environment
// override is read here so no code changes are needed to tune it, but nothing is
// required in .env for the app to work.

// A part is considered "low stock" when its quantity is at or below this value.
// Mirrors the client default in client/src/constants.js.
export const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD) || 5;
