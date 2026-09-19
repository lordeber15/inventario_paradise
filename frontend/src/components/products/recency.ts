// A week reads as "just landed" without the eyebrow going stale a day or two
// after a normal restocking cadence. One window, shared by the card's
// "Nuevo" eyebrow, the home's stats strip and its "Novedades" rail — three
// places that would otherwise each pick their own idea of "recent".
export const NEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000

export function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_WITHIN_MS
}
