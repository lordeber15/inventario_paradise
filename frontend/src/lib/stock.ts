export interface StockTone {
  color: string
  label: string
}

/** Shared by StockBadge (the exact count, for the register and the admin
 * list) and PriceTag (the storefront's price tag, tinted the same way but
 * carrying a price instead of a count) — one place decides what "low" and
 * "out" mean. */
export function stockTone(stock: number): StockTone {
  if (stock <= 0) return { color: "var(--color-stock-out)", label: "Agotado" }
  if (stock <= 5) return { color: "var(--color-stock-low)", label: "Stock bajo" }
  return { color: "var(--color-stock-good)", label: "En stock" }
}
