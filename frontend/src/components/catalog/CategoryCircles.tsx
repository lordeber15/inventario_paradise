import type { ReactNode } from "react"
import { RAIL_CLASS } from "./styles"

export interface CategorySummary {
  name: string
  count: number
  /** The most recent product in the category that has a photo, if any. */
  thumbnailUrl: string | null
}

interface CategoryCirclesProps {
  categories: CategorySummary[]
  total: number
  active: string | null
  onChange: (category: string | null) => void
}

const CIRCLE_CLASS =
  "flex h-18 w-18 items-center justify-center overflow-hidden rounded-full bg-inset ring-2 ring-offset-2 ring-offset-paper " +
  "transition-[box-shadow,transform] duration-150 group-hover/circle:scale-[1.03] sm:h-24 sm:w-24"

/** The Stitch design's category circles, and the catalogue's *only* category
 * control — they replaced the chip row rather than joining it, so one piece
 * of state has one control. Each circle wears the newest photo in its
 * category; aria-pressed carries the active state, and the ring only
 * mirrors it. Scrolls sideways on a phone, wraps centred from `sm`. */
export function CategoryCircles({ categories, total, active, onChange }: CategoryCirclesProps) {
  return (
    <nav aria-label="Categorías">
      <ul className={`${RAIL_CLASS} sm:flex-wrap sm:justify-center sm:gap-5`}>
        <li className="snap-start">
          <CircleButton label="Todo" count={total} pressed={active === null} onClick={() => onChange(null)}>
            {/* Decorative: the label under the circle already says it, and
                without this the button would be announced as "Todo Todo 9". */}
            <span className="font-display text-lg font-medium text-accent" aria-hidden="true">
              Todo
            </span>
          </CircleButton>
        </li>
        {categories.map((category) => (
          <li key={category.name} className="snap-start">
            <CircleButton
              label={category.name}
              count={category.count}
              pressed={active === category.name}
              onClick={() => onChange(category.name)}
            >
              {category.thumbnailUrl ? (
                <img src={category.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-2xl font-medium text-ink-soft" aria-hidden="true">
                  {category.name.charAt(0).toUpperCase()}
                </span>
              )}
            </CircleButton>
          </li>
        ))}
      </ul>
    </nav>
  )
}

interface CircleButtonProps {
  label: string
  count: number
  pressed: boolean
  onClick: () => void
  children: ReactNode
}

function CircleButton({ label, count, pressed, onClick, children }: CircleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="group/circle flex w-24 flex-col items-center gap-2 rounded-2xl pb-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:w-28"
    >
      <span className={`${CIRCLE_CLASS} ${pressed ? "ring-accent" : "ring-transparent"}`}>{children}</span>
      {/* Two lines, not a truncation: a category name is the whole label,
          and "Cuidado pe…" tells the visitor nothing. */}
      <span className="flex w-full flex-col">
        <span className={`line-clamp-2 text-xs leading-tight sm:text-sm ${pressed ? "font-semibold text-ink" : "font-medium text-ink"}`}>
          {label}
        </span>
        <span className="mt-0.5 text-xs tabular-nums text-ink-soft">{count}</span>
      </span>
    </button>
  )
}
