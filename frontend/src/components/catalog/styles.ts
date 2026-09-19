// The home's own vocabulary, shared by its blocks so the hero, the rail,
// the callout and the footer read as one page. Everything here composes the
// global tokens; nothing redefines a colour.

/** Small caps label above a title ("Catálogo en línea", "Novedades"). */
export const EYEBROW_CLASS = "text-[11px] font-medium uppercase tracking-[0.14em] text-ink-soft"

/** Section titles in the display serif — the editorial voice this page
 * extends beyond the wordmark (see .font-display in index.css). */
export const SECTION_TITLE_CLASS = "font-display text-2xl font-medium leading-tight tracking-tight text-ink sm:text-3xl"

/** Pill buttons: the one place the app uses them. The rest of the UI keeps
 * rounded-lg; on this page the rounder shape matches the circles and the
 * photo corners, and the pair below is the whole set — primary is ink on
 * paper, secondary is a bordered card. */
export const BUTTON_PRIMARY_CLASS =
  "inline-flex items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper " +
  "transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"

export const BUTTON_SECONDARY_CLASS =
  "inline-flex items-center justify-center rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink " +
  "transition-colors duration-150 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"

/** Horizontal rail on phones: bleeds to the screen edge (-mx-4/px-4 undo the
 * page gutter) and snaps per item; from `sm` the caller turns it back into a
 * grid or a centred row. */
export const RAIL_CLASS = "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scroll-pl-4 sm:mx-0 sm:px-0"
