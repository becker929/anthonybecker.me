// The rules of the high score tables, apart from the Worker so its tests can import them.
// (A Worker module may export nothing but its handler.)

export const GAMES = { tube: { max: 500 }, bertie: { max: 5000 } };
export const ROWS = 7;


/// A name as the board can show it: capitals and digits, eight at most. Returns "" if nothing is left.
export function cleanName(name) {
  return String(name ?? "").toUpperCase().replace(/[^A-Z0-9 .-]/g, "").trim().slice(0, 8).trim();
}

/// Adds an entry to a table and returns the new table, best first. Equal scores keep the earlier one above.
export function place(table, entry) {
  const next = [...table, entry].sort((a, b) => b.score - a.score || a.at - b.at);
  return next.slice(0, ROWS);
}
