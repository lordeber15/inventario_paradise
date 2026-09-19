interface DailyTrendChartProps {
  items: { fecha: string; total: number }[]
  formatValue?: (value: number) => string
}

const VIEWBOX_HEIGHT = 40

/** Vertical columns, one per day — the trend BarChart's own ranked rows
 * can't show, since those always sort by value and drop "when" entirely.
 * Same hand-rolled SVG approach as BarChart (see docs/PLAN-POS.md §7): no
 * charting library for a handful of bars. */
export function DailyTrendChart({ items, formatValue = (value) => String(value) }: DailyTrendChartProps) {
  if (items.length === 0) {
    return <p className="text-xs text-ink-soft">Sin datos en este rango.</p>
  }

  const max = Math.max(...items.map((item) => item.total), 1)
  const barWidth = 100 / items.length
  const gap = Math.min(barWidth * 0.2, 1)

  return (
    <svg
      viewBox={`0 0 100 ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-28 w-full"
      role="img"
      aria-label="Ventas por día"
    >
      {items.map((item, index) => {
        const height = Math.max((item.total / max) * VIEWBOX_HEIGHT, 0.5)
        return (
          <rect
            key={item.fecha}
            x={index * barWidth + gap / 2}
            y={VIEWBOX_HEIGHT - height}
            width={Math.max(barWidth - gap, 0)}
            height={height}
            rx="0.5"
            className="fill-accent-muted"
          >
            <title>
              {item.fecha}: {formatValue(item.total)}
            </title>
          </rect>
        )
      })}
    </svg>
  )
}
