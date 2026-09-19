import { useEffect, useState } from "react"
import { searchProductsForSale, type SellerProduct } from "../../api/products"
import { formatPrice } from "../../lib/currency"
import { StockBadge } from "../products/StockBadge"
import {
  CARD_BODY_CLASS,
  CARD_CLASS,
  CARD_FOOTER_CLASS,
  CARD_IMG_CLASS,
  CARD_MEDIA_CLASS,
  CARD_PRICE_CLASS,
  CARD_TITLE_CLASS,
} from "../products/cardStyles"

interface ProductSearchProps {
  onSelect: (product: SellerProduct) => void
  /** How many of each product are already in the cart, by product id. The
   * cart stays the single source of truth — this grid has no selection state
   * of its own, it just reflects what's in there. */
  quantities: Map<string, number>
  onChangeQuantity: (productId: string, cantidad: number) => void
  /** Scanning lives next to the search box rather than after the grid: they
   * are the two ways of finding a product, and with 50 cards below, a button
   * under the grid is a long scroll away. */
  onScan: () => void
}

const DEBOUNCE_MS = 300

// Only the first row or two get the staggered entrance; the rest appear at
// once, same rule the public catalogue follows.
const STAGGER_COUNT = 6

// Capped with its own scroll below lg: on a phone the grid is the whole
// screen, and an uncapped one would bury the cart and the "Cobrar" button
// under 50 cards. On desktop the grid has its own column, so it just grows.
// The p-0.5 keeps the focus ring from being clipped by that scroll box.
const GRID_CLASS =
  "mt-3 grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto p-0.5 " +
  "sm:grid-cols-3 lg:max-h-none lg:grid-cols-2 lg:overflow-visible xl:grid-cols-3"

export function ProductSearch({ onSelect, quantities, onChangeQuantity, onScan }: ProductSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SellerProduct[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true)
      searchProductsForSale(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar por nombre o descripción…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-inset px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="button"
          onClick={onScan}
          className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-transform active:scale-[0.98]"
        >
          Escanear producto
        </button>
      </div>

      {loading && <p className="mt-2 text-xs text-ink-soft">Buscando…</p>}

      {/* Named because its +/− buttons share their aria-label text with the
          cart's own +/− (both say "Agregar una unidad de {producto}") —
          without this, a screen reader (and a test locator) can't tell the
          two apart. */}
      {!loading && results.length > 0 && (
        <ul aria-label="Resultados de búsqueda" className={GRID_CLASS}>
          {results.map((product, index) => {
            const cantidad = quantities.get(product.id) ?? 0
            const agotado = product.stock <= 0
            const enElTope = cantidad >= product.stock

            return (
              <li
                key={product.id}
                className={index < STAGGER_COUNT ? "catalog-item-in" : undefined}
                style={index < STAGGER_COUNT ? { animationDelay: `${index * 40}ms` } : undefined}
              >
                <div
                  className={`${CARD_CLASS} h-full transition-colors ${
                    cantidad > 0 ? "border-accent bg-accent-soft" : ""
                  } ${agotado ? "opacity-60" : ""}`}
                >
                  {/* The whole card is this one button, so its accessible name
                      is "{nombre} {precio}" — the +/− controls below are its
                      siblings, never nested inside it (a button inside a button
                      is invalid, and it would swallow their labels). */}
                  <button
                    type="button"
                    onClick={() => onSelect(product)}
                    disabled={agotado || enElTope}
                    className="flex flex-1 flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed"
                    title={
                      agotado
                        ? "Sin stock"
                        : enElTope
                          ? `No queda más stock: ${product.stock} en total`
                          : undefined
                    }
                  >
                    <span className={CARD_MEDIA_CLASS}>
                      <img
                        src={product.thumbnail_url ?? product.image_url}
                        alt=""
                        loading="lazy"
                        className={CARD_IMG_CLASS}
                      />
                    </span>

                    <span className={CARD_BODY_CLASS}>
                      <span className={CARD_TITLE_CLASS}>{product.name}</span>
                      <span className={CARD_FOOTER_CLASS}>
                        <span className={CARD_PRICE_CLASS}>{formatPrice(product.price)}</span>
                        <StockBadge stock={product.stock} />
                      </span>
                    </span>
                  </button>

                  {cantidad > 0 && (
                    <div className="flex items-center justify-between border-t border-line px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onChangeQuantity(product.id, cantidad - 1)}
                        aria-label={`Quitar una unidad de ${product.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink transition-transform active:scale-90"
                      >
                        −
                      </button>
                      <span className="text-sm font-medium tabular-nums text-ink">{cantidad}</span>
                      <button
                        type="button"
                        onClick={() => onChangeQuantity(product.id, cantidad + 1)}
                        disabled={enElTope}
                        aria-label={`Agregar una unidad de ${product.name}`}
                        title={enElTope ? `No queda más stock: ${product.stock} en total` : undefined}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink transition-transform active:scale-90 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p className="mt-2 text-xs text-ink-soft">Sin resultados.</p>
      )}
    </div>
  )
}
