import type { CSSProperties } from "react"
import type { PublicProduct } from "../../api/products"
import { PriceTag } from "./PriceTag"
import {
  CARD_BODY_CLASS,
  CARD_CLASS,
  CARD_EYEBROW_CLASS,
  CARD_FOOTER_CLASS,
  CARD_IMG_CLASS,
  CARD_IMG_FALLBACK_CLASS,
  CARD_MEDIA_PORTRAIT_CLASS,
  CARD_SUBTITLE_CLASS,
  CARD_TITLE_DISPLAY_CLASS,
} from "./cardStyles"
import { isNew } from "./recency"

interface ProductCardProps {
  product: PublicProduct
  onSelect: (product: PublicProduct) => void
  className?: string
  style?: CSSProperties
}

/** The public catalogue's card, extracted from the grid so the home's
 * "Novedades" rail and the grid render exactly the same thing — one card,
 * one ratio, one place to change either. `className`/`style` are the `<li>`'s
 * (the grid staggers its first screenful, the rail sizes its items). */
export function ProductCard({ product, onSelect, className, style }: ProductCardProps) {
  const eyebrowNew = isNew(product.created_at)
  const hasEyebrow = eyebrowNew || product.category
  // Seed data (and some real catalogs migrated from a name-only system)
  // sets the description to a copy of the name — showing it twice as
  // both title and subtitle would read as a rendering bug, not content.
  const showDescription = product.description && product.description !== product.name

  return (
    <li className={className} style={style}>
      {/* The photo is the button, so `aria-label="Ver …"` keeps naming the
          one thing that opens the modal. */}
      <div className={`${CARD_CLASS} h-full`}>
        <button
          type="button"
          onClick={() => onSelect(product)}
          aria-label={`Ver ${product.name}`}
          className={`${CARD_MEDIA_PORTRAIT_CLASS} cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-accent/50`}
        >
          {product.thumbnail_url ? (
            <img src={product.thumbnail_url} alt="" loading="lazy" className={CARD_IMG_CLASS} />
          ) : (
            <span className={CARD_IMG_FALLBACK_CLASS} aria-hidden="true">
              —
            </span>
          )}
        </button>

        <div className={CARD_BODY_CLASS}>
          {hasEyebrow && (
            <p className={CARD_EYEBROW_CLASS}>
              {eyebrowNew && <span className="text-accent">Nuevo</span>}
              {eyebrowNew && product.category && <span aria-hidden="true">·</span>}
              {product.category && <span>{product.category}</span>}
            </p>
          )}
          <p className={CARD_TITLE_DISPLAY_CLASS}>{product.name}</p>
          {showDescription && <p className={CARD_SUBTITLE_CLASS}>{product.description}</p>}
          <div className={CARD_FOOTER_CLASS}>
            <PriceTag price={product.price} stock={product.stock} />
          </div>
        </div>
      </div>
    </li>
  )
}
