// One visual language for the two product grids that exist — the public
// catalogue and the sale screen's picker. Shared as class constants rather
// than as one component with flags: the two differ in what they show (the
// catalogue never receives `name`), what tapping does (open a modal vs add to
// the cart) and what state they carry, so a single component would be mostly
// branches. The *look* is what has to stay in sync, and that lives here.

export const CARD_CLASS =
  "group/card relative flex flex-col overflow-hidden rounded-xl border border-line " +
  "bg-surface shadow-[0_1px_2px_var(--color-card-shadow)]"

/** Square photo area — the register's picker, where density wins. */
export const CARD_MEDIA_CLASS = "relative aspect-square w-full overflow-hidden bg-inset"

/** Portrait (4:5) photo area — the public catalogue, where the photo is the
 * point. Same box otherwise, so everything positioned against it (the image,
 * the fallback) is shared; only the ratio differs between the two grids. */
export const CARD_MEDIA_PORTRAIT_CLASS = "relative aspect-[4/5] w-full overflow-hidden bg-inset"

export const CARD_IMG_CLASS =
  "h-full w-full object-cover transition-transform duration-200 ease-out group-hover/card:scale-105"

/** Placeholder for a product with no photo, same footprint as the image. */
export const CARD_IMG_FALLBACK_CLASS = "flex h-full w-full items-center justify-center text-ink-soft"

export const CARD_BODY_CLASS = "flex flex-1 flex-col gap-1 p-3"

/** Price and stock share the last row of the card.
 *
 * The badge deliberately does NOT sit on top of the photo, which is where the
 * reference design puts its promo chip: that chip is solid and opaque, while
 * StockBadge is a translucent tint whose contrast is measured against
 * `surface` (npm run check:contrast). Over an arbitrary product photo that
 * measurement means nothing — a dark photo makes the number unreadable. */
export const CARD_FOOTER_CLASS = "mt-auto flex items-center justify-between gap-2 pt-1"

/** Two lines max, so cards in a row keep a common height. */
export const CARD_TITLE_CLASS =
  "text-sm text-ink [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden"

/** The catalogue's title: the same clamp, set in the display serif — the one
 * place outside the wordmark where a product name gets the editorial voice
 * (see .font-display in index.css). The register keeps the sans title. */
export const CARD_TITLE_DISPLAY_CLASS = `${CARD_TITLE_CLASS} font-display text-[15px] font-medium leading-snug`

/** One line of supporting copy under the title (the public catalogue's
 * description, when it says something the name doesn't already say). */
export const CARD_SUBTITLE_CLASS = "truncate text-xs text-ink-soft"

/** The "Nuevo" / category eyebrow above the title — text, not a chip pinned
 * to the photo: StockBadge's own contrast note (below) is exactly why
 * nothing reads here against an arbitrary product photo either. */
export const CARD_EYEBROW_CLASS = "flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-soft"

export const CARD_PRICE_CLASS = "text-base font-semibold tabular-nums text-ink"
