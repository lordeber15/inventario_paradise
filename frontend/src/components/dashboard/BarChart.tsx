interface BarChartItem {
  label: string
  value: number
}

interface BarChartProps {
  items: BarChartItem[]
  formatValue?: (value: number) => string
}

/** A hand-rolled SVG bar (just two <rect>s per row: a track and a fill),
 * not a charting library — a handful of ranked comparisons like these don't
 * justify ~100KB gzip of Recharts on a bundle this size (see docs/PLAN-POS.md
 * §7). Static, no width animation: width is a layout property, not a
 * compositor one, so it's left alone per this project's animation rules. */
export function BarChart({ items, formatValue = (value) => String(value) }: BarChartProps) {
  if (items.length === 0) {
    return <p className="text-xs text-ink-soft">Sin datos en este rango.</p>
  }

  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-xs">
          <span className="truncate text-ink-soft" title={item.label}>
            {item.label}
          </span>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-2.5 w-full" role="presentation">
            <rect x="0" y="0" width="100" height="10" rx="5" className="fill-line" />
            <rect x="0" y="0" width={(item.value / max) * 100} height="10" rx="5" className="fill-accent-muted" />
          </svg>
          <span className="tabular-nums text-ink">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  )
}
