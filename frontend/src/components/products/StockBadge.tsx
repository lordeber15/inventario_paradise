import { stockTone } from "../../lib/stock"

interface StockBadgeProps {
  stock: number
}

export function StockBadge({ stock }: StockBadgeProps) {
  const tone = stockTone(stock)

  return (
    <span
      className="tag-badge inline-flex items-center py-1 pl-4 pr-2.5 text-xs font-semibold tabular-nums cursor-default"
      // A filled shape, not an outlined one: clip-path only clips existing
      // paint, it never draws a new border stroke along the cut edge — an
      // outlined version of this tag left its pointed tip with no visible
      // line at all. A background fill has no such problem since it isn't
      // edge-dependent, so it follows the clipped silhouette correctly.
      //
      // The tint is a shade of the text colour itself, so it eats into the
      // number's own contrast — at 16% none of the three tones cleared 4.5:1,
      // which 12px semibold needs. 12% plus the darker tokens does.
      style={{ backgroundColor: `color-mix(in srgb, ${tone.color} 12%, transparent)`, color: tone.color }}
      title={tone.label}
    >
      {stock}
    </span>
  )
}
