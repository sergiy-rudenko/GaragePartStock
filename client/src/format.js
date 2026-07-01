// Shared display formatters.

// Format a numeric value as USD currency, e.g. 1728.5 -> "$1,728.50".
export function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}
