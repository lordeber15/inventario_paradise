import { useEffect, useRef, useState } from "react"
import type { PublicProduct } from "../../api/products"
import { formatPrice } from "../../lib/currency"
import { stockTone } from "../../lib/stock"

interface ProductModalProps {
  product: PublicProduct | null
  onClose: () => void
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // Lags one step behind `product` so the panel keeps its content while the
  // closing transition plays, instead of emptying the moment it starts to fade.
  const [shown, setShown] = useState<PublicProduct | null>(product)
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    if (product) {
      setShown(product)
      setActiveImage(0)
    }
  }, [product])

  useEffect(() => {
    if (!product) return
    const dialog = ref.current
    dialog?.showModal()
    // showModal() throws if called on an already-open dialog, and StrictMode
    // runs effects twice in dev — closing on cleanup keeps it callable again.
    return () => dialog?.close()
  }, [product])

  // A product always has at least one photo (enforced at creation), so this
  // never renders zero thumbnails — but `shown.images` still guards against
  // an empty array rather than assuming index 0 exists.
  const gallery = shown?.images.length ? shown.images : null
  const mainImage = gallery?.[activeImage]?.image_url ?? shown?.image_url
  const showDescription = shown && shown.description && shown.description !== shown.name
  const tone = stockTone(shown?.stock ?? 0)

  return (
    <dialog
      ref={ref}
      // Fires on Esc and on close() — without this, React would still think the
      // modal is open and the same product couldn't be reopened.
      onClose={onClose}
      onClick={(event) => {
        // The panel is a child, so a click landing on the dialog itself can only
        // be the backdrop. Requires p-0 on the dialog for the hit area to match.
        if (event.target === ref.current) onClose()
      }}
      aria-labelledby="product-modal-title"
      className="product-dialog w-[min(92vw,34rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl"
    >
      {shown && (
        <div>
          <div className="relative">
            <img
              src={mainImage}
              alt=""
              className="max-h-[58vh] w-full rounded-t-2xl bg-inset object-contain"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-lg font-semibold text-ink shadow-sm backdrop-blur transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              ×
            </button>
          </div>

          {/* Only worth a strip once there's a second angle to switch to — the
              six photos a product can carry exist for recognition, not just
              the cover, so the gallery is what lets them also sell. */}
          {gallery && gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto border-b border-line p-3">
              {gallery.map((image, index) => (
                <button
                  key={image.image_url}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`Ver foto ${index + 1} de ${gallery.length}`}
                  aria-current={index === activeImage}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    index === activeImage ? "border-accent" : "border-transparent"
                  }`}
                >
                  <img src={image.thumbnail_url ?? image.image_url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2 p-5">
            {shown.category && (
              <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{shown.category}</p>
            )}
            <h2 id="product-modal-title" className="text-base leading-snug text-ink">
              {shown.name}
            </h2>
            {showDescription && <p className="text-sm text-ink-soft">{shown.description}</p>}

            <div className="flex items-baseline gap-3 pt-2">
              <span className="text-2xl font-semibold tabular-nums text-ink">
                {formatPrice(shown.price)}
              </span>
              {/* Same scarcity copy as the catalogue's PriceTag, minus the tag
                  shape: a detail view earns a plain, prominent number instead
                  of repeating the small-card affordance. */}
              {tone.label !== "En stock" && (
                <span className="text-sm font-medium" style={{ color: tone.color }}>
                  {tone.label === "Agotado" ? "Agotado" : `Últimas ${shown.stock}`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}
