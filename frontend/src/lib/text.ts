/** Folds a string down to what a search should actually compare: lowercase
 * and without accents, so typing "cafe" matches "Café". The catalogue keeps
 * its accents — they're what the customer reads and what gets printed on the
 * ticket — and the matching is what bends. NFD splits an accented letter into
 * letter + combining mark and the regex drops the marks, which also folds
 * ñ→n and ü→u — the same result Postgres's unaccent() gives the server-side
 * search (migration 0005), so both search boxes behave the same way. */
export function searchable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}
