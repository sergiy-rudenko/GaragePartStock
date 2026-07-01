// Session-lifetime UI preferences held in memory (deliberately NOT localStorage).
// This keeps a user's sort/order/density choices stable across component
// remounts — e.g. switching between cars remounts PartsPanel — while resetting
// cleanly on a full page reload. No dependencies, no persistence side effects.

const prefs = {
  sort: 'name',
  order: 'asc',
  density: 'comfortable', // 'comfortable' | 'compact'
};

export function getPref(key) {
  return prefs[key];
}

export function setPref(key, value) {
  prefs[key] = value;
}
