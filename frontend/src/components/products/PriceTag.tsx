import { formatPrice } from "../../lib/currency"
import { stockTone } from "../../lib/stock"

interface PriceTagProps {
  price: number
  stock: number
}

/** The storefront's real price tag: the same hang-tag silhouette as
 * StockBadge (index.css's .tag-badge — the brand's signature shape since
 * Fase B), sized to carry a price instead of a count. A shopper needs to
 * know what something costs and whether it's worth hurrying, not the exact
 * number left — StockBadge keeps reporting that number, unchanged, where it
 * actually matters: the register and the admin list.
 *
 * The tint still follows availability (tied to the same `stockTone` classes
 * StockBadge uses, not a second hardcoded threshold), so a scarce or
 * sold-out tag already reads differently before anyone reads the words
 * next to it — which only appear when there's something worth saying. */
export function PriceTag({ price, stock }: PriceTagProps) {
  const tone = stockTone(stock)
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="tag-badge inline-flex items-center py-1.5 pl-5 pr-3 text-sm font-semibold tabular-nums"
        style={{ backgroundColor: `color-mix(in srgb, ${tone.color} 12%, transparent)`, color: tone.color }}
      >
        {formatPrice(price)}
      </span>
      {tone.label === "Agotado" && (
        <span className="text-xs font-medium" style={{ color: tone.color }}>
          Agotado
        </span>
      )}
      {tone.label === "Stock bajo" && (
        <span className="text-xs font-medium" style={{ color: tone.color }}>
          Últimas {stock}
        </span>
      )}
    </span>
  )
}
