interface StatsStripProps {
  productCount: number
  categoryCount: number
  newCount: number
}

/** The Stitch design's row of figures, with the three numbers the catalogue
 * can actually stand behind. A zero stays a zero — "0 nuevos esta semana"
 * is information, and hiding it would make the strip lie by omission. */
export function StatsStrip({ productCount, categoryCount, newCount }: StatsStripProps) {
  const stats: Array<[number, string]> = [
    [productCount, productCount === 1 ? "artículo" : "artículos"],
    [categoryCount, categoryCount === 1 ? "categoría" : "categorías"],
    [newCount, newCount === 1 ? "nuevo esta semana" : "nuevos esta semana"],
  ]
  return (
    <dl className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface shadow-[0_1px_2px_var(--color-card-shadow)]">
      {stats.map(([value, label]) => (
        // The number reads first, the label under it — dt/dd keep their
        // required order in the markup, the column just flips them.
        <div key={label} className="flex flex-col-reverse items-center px-2 py-4 text-center sm:py-5">
          <dt className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</dt>
          <dd className="font-display text-2xl font-medium tabular-nums text-ink sm:text-3xl">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
