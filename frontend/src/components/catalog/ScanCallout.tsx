import { BUTTON_PRIMARY_CLASS, SECTION_TITLE_CLASS } from "./styles"

interface ScanCalloutProps {
  onScan: () => void
}

/** Of the four "services" in the Stitch design (shipping, packaging, …) the
 * only one this app really offers is finding a product from a photo — so it
 * gets the one card, not a row of four. Named "Subir una foto" so neither
 * the header's nor the hero's scan button shares its accessible name. */
export function ScanCallout({ onScan }: ScanCalloutProps) {
  return (
    <section
      aria-labelledby="scan-callout-title"
      className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface px-6 py-8 text-center shadow-[0_1px_2px_var(--color-card-shadow)] sm:px-10 sm:py-10"
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.2-2h5l1.2 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
          <circle cx="12" cy="12.5" r="3.5" />
        </svg>
      </span>
      <h2 id="scan-callout-title" className={`${SECTION_TITLE_CLASS} mt-4 text-balance`}>
        ¿Viste algo y no sabés cómo se llama?
      </h2>
      <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-ink-soft sm:text-base">
        Sacale una foto al artículo o a su código de barras y te mostramos lo más parecido que hay en el catálogo.
      </p>
      <button type="button" onClick={onScan} className={`${BUTTON_PRIMARY_CLASS} mt-6`}>
        Subir una foto
      </button>
    </section>
  )
}
