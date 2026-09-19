import type { PublicProduct } from "../../api/products"
import { PriceTag } from "../products/PriceTag"
import { isNew } from "../products/recency"
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, EYEBROW_CLASS } from "./styles"

interface HeroProps {
  /** The shop's configured name (BrandLogo's same source), or its placeholder. */
  title: string
  productCount: number
  categoryCount: number
  /** The most recent product that is in stock — the one photo on the page
   * that is shown at full size rather than as a thumbnail. */
  featured: PublicProduct
  onSelect: (product: PublicProduct) => void
  onScan: () => void
}

function inventoryLine(products: number, categories: number): string {
  const items = products === 1 ? "1 artículo" : `${products} artículos`
  if (categories === 0) return items
  return `${items} en ${categories === 1 ? "1 categoría" : `${categories} categorías`}`
}

/** The editorial opening the Stitch design leads with, fed only by what the
 * app actually knows: the shop's name, how much is on the shelves, and the
 * newest photo. No tagline field exists, so the copy states the inventory
 * and the one thing this catalogue can do that a printed one can't. */
export function Hero({ title, productCount, categoryCount, featured, onSelect, onScan }: HeroProps) {
  return (
    // A fixed label rather than aria-labelledby the h1: the title is the
    // shop's name, which arrives asynchronously (and may not be set at all),
    // so nothing — a screen reader's landmark list, a test — can rely on it.
    <section aria-label="Portada" className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
      <div className="order-2 lg:order-1">
        <p className={EYEBROW_CLASS}>Catálogo en línea</p>
        <h1
          className="mt-3 font-display text-4xl font-medium leading-[1.05] tracking-tight text-ink text-balance sm:text-5xl lg:text-6xl"
        >
          {title}
        </h1>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-soft sm:text-lg">
          {inventoryLine(productCount, categoryCount)}, con precio y disponibilidad al día. ¿Viste algo que te
          gustó? Sacale una foto y buscamos lo más parecido.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#catalogo" className={BUTTON_PRIMARY_CLASS}>
            Ver catálogo
          </a>
          {/* Named differently from the header's "Buscar por foto" on purpose:
              two buttons with one accessible name would be ambiguous to a
              screen reader and to the e2e locator that opens the scan modal. */}
          <button type="button" onClick={onScan} className={BUTTON_SECONDARY_CLASS}>
            Probar la búsqueda por foto
          </button>
        </div>
      </div>

      <div className="relative order-1 lg:order-2">
        <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-inset">
          <img src={featured.image_url} alt="" className="h-full w-full object-cover" />
        </div>
        {/* Opaque on purpose, not a glass panel over the photo: PriceTag's
            tint is measured against `surface` (npm run check:contrast), and
            that number means nothing over an arbitrary product photo — the
            same rule cardStyles.ts follows for the badge. */}
        <button
          type="button"
          onClick={() => onSelect(featured)}
          className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left shadow-[0_8px_24px_var(--color-card-shadow)] transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:right-auto sm:max-w-sm"
        >
          <span className="min-w-0 flex-1">
            <span className={`${EYEBROW_CLASS} block`}>{isNew(featured.created_at) ? "Recién llegado" : "Lo último"}</span>
            <span className="mt-0.5 block truncate font-display text-base font-medium leading-snug text-ink">
              {featured.name}
            </span>
          </span>
          <PriceTag price={featured.price} stock={featured.stock} />
        </button>
      </div>
    </section>
  )
}
