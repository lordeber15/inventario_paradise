import type { PublicProduct } from "../../api/products"
import { ProductCard } from "../products/ProductCard"
import { EYEBROW_CLASS, RAIL_CLASS, SECTION_TITLE_CLASS } from "./styles"

interface NewArrivalsProps {
  products: PublicProduct[]
  onSelect: (product: PublicProduct) => void
}

/** Where the Stitch design shows "favourites of the season" — a ranking the
 * app has no public data for (sales never leave the register) — this shows
 * what it does know: what arrived this week, newest first. The caller hides
 * the section with fewer than two, since one card is not a "rail". */
export function NewArrivals({ products, onSelect }: NewArrivalsProps) {
  return (
    <section aria-labelledby="novedades-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className={EYEBROW_CLASS}>Últimos 7 días</p>
          <h2 id="novedades-title" className={`${SECTION_TITLE_CLASS} mt-1`}>
            Novedades
          </h2>
        </div>
        <p className="text-sm tabular-nums text-ink-soft">{products.length}</p>
      </div>
      {/* On a phone the rail shows a little more than two cards, so the cut
          edge itself says "there's more this way". */}
      <ul className={`${RAIL_CLASS} sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible lg:grid-cols-4`}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelect={onSelect}
            className="w-[42vw] shrink-0 snap-start sm:w-auto"
          />
        ))}
      </ul>
    </section>
  )
}
