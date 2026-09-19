import { formatPrice } from "../../lib/currency"

export interface CartLine {
  productId: string
  name: string
  unitPrice: number
  // Stock as known when the line was added/last touched — a soft client-side
  // cap on the +/- control. The backend re-checks the real stock atomically
  // at checkout regardless (see services/sales.py), so this is only here to
  // avoid an obviously-doomed increment, never the actual guarantee.
  stock: number
  cantidad: number
  thumbnailUrl: string | null
}

interface CartProps {
  lines: CartLine[]
  onChangeQuantity: (productId: string, cantidad: number) => void
  onRemove: (productId: string) => void
}

export function Cart({ lines, onChangeQuantity, onRemove }: CartProps) {
  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
        El carrito está vacío. Busca un producto o escanea una foto.
      </div>
    )
  }

  // Two rows per line rather than one: the cart sits in a 22rem column on
  // desktop, where a single row squeezed the product name to a few characters.
  return (
    <ul className="space-y-2">
      {lines.map((line) => (
        <li
          key={line.productId}
          className="cart-line-in rounded-lg border border-line bg-surface px-3 py-2"
        >
          <div className="flex items-center gap-2">
            {line.thumbnailUrl && (
              <img
                src={line.thumbnailUrl}
                alt=""
                loading="lazy"
                className="h-9 w-9 shrink-0 rounded-md object-cover"
              />
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{line.name}</p>
              <p className="text-xs text-ink-soft">{formatPrice(line.unitPrice)} c/u</p>
            </div>

            <button
              type="button"
              onClick={() => onRemove(line.productId)}
              aria-label={`Quitar ${line.name} del carrito`}
              className="shrink-0 text-sm transition-transform active:scale-90"
              style={{ color: "var(--color-stock-out)" }}
            >
              ×
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChangeQuantity(line.productId, line.cantidad - 1)}
                aria-label={`Quitar una unidad de ${line.name}`}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink transition-transform active:scale-90"
              >
                −
              </button>
              <span className="w-6 text-center text-sm tabular-nums text-ink">{line.cantidad}</span>
              <button
                type="button"
                onClick={() => onChangeQuantity(line.productId, line.cantidad + 1)}
                disabled={line.cantidad >= line.stock}
                aria-label={`Agregar una unidad de ${line.name}`}
                title={line.cantidad >= line.stock ? `No queda más stock: ${line.stock} en total` : undefined}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink transition-transform active:scale-90 disabled:opacity-40"
              >
                +
              </button>
            </div>

            <span className="text-sm font-medium tabular-nums text-ink">
              {formatPrice(line.unitPrice * line.cantidad)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
