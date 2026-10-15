// How the map overlay looks on this device (Piotr, 11.10.2026): Ustawienia →
// Mapa. Presentation only — never in a game save; kept with the table's other
// device preferences (kanto.table.prefs.v1, `map`). Every value 1 = the board
// as it was drawn before these settings existed.
//   lines        the roads, tunnels and the shortcut (opacity; a road you can
//                take now always stays fully visible)
//   cities       city, town and special-place markers (opacity)
//   routes       route markers (opacity)
//   cityNames    names of cities, towns and special places (size)
//   routeNames   names of routes (size)
//   allRouteNames  every route named (otherwise only the merged ones, as before)
// A marker you can move to, or stand on, always stays fully visible.

export const MAP_PREFS = [
  { key: 'lines', label: 'Linie połączeń', kind: 'opacity', min: 0, max: 1, step: 0.05 },
  { key: 'cities', label: 'Znaczki miast i miejsc', kind: 'opacity', min: 0, max: 1, step: 0.05 },
  { key: 'routes', label: 'Znaczki dróg', kind: 'opacity', min: 0, max: 1, step: 0.05 },
  { key: 'cityNames', label: 'Nazwy miast i miejsc', kind: 'size', min: 0.6, max: 2, step: 0.05 },
  { key: 'routeNames', label: 'Nazwy dróg', kind: 'size', min: 0.6, max: 2, step: 0.05 },
];

export const MAP_DEFAULTS = Object.freeze({ lines: 1, cities: 1, routes: 1, cityNames: 1, routeNames: 1, allRouteNames: false });

const CSS_VAR = { lines: '--map-lines', cities: '--map-cities', routes: '--map-routes', cityNames: '--map-city-names', routeNames: '--map-route-names' };

// A stored value made safe: a number in its range (2 decimals), else the default.
export function normalizeMapPrefs(raw) {
  const out = { ...MAP_DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const p of MAP_PREFS) {
    const v = Number(raw[p.key]);
    if (raw[p.key] !== undefined && raw[p.key] !== null && Number.isFinite(v)) out[p.key] = Math.round(Math.min(p.max, Math.max(p.min, v)) * 100) / 100;
  }
  out.allRouteNames = raw.allRouteNames === true;
  return out;
}

export function sameMapPrefs(a, b) {
  return Object.keys(MAP_DEFAULTS).every((k) => a[k] === b[k]);
}

// What the board root gets: CSS variables (table.css reads them) and a class.
export function mapPrefsStyle(prefs) {
  const p = normalizeMapPrefs(prefs);
  return { vars: Object.fromEntries(MAP_PREFS.map((d) => [CSS_VAR[d.key], String(p[d.key])])), routeNames: p.allRouteNames };
}

export function applyMapPrefs(root, prefs) {
  const { vars, routeNames } = mapPrefsStyle(prefs);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  root.classList.toggle('route-names', routeNames);
}

// „65 %”: how a value reads next to its slider.
export function mapPrefLabel(value) {
  return `${Math.round(value * 100)} %`;
}
