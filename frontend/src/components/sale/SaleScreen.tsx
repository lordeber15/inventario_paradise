import { useEffect, useRef, useState } from "react"
import type { SellerProduct } from "../../api/products"
import type { RecognitionMatch } from "../../api/recognition"
import { ApiError } from "../../api/client"
import { createSale, type Sale } from "../../api/sales"
import type { CashSession } from "../../api/cashSessions"
import { useAuth } from "../../context/AuthContext"
import { formatPrice } from "../../lib/currency"
import { BrandLogo } from "../layout/BrandLogo"
import { ThemeToggle } from "../layout/ThemeToggle"
import { Cart, type CartLine } from "./Cart"
import { CloseRegisterModal } from "./CloseRegisterModal"
import { PaymentsForm, type PaymentLine } from "./PaymentsForm"
import { ProductSearch } from "./ProductSearch"
import { ScanToCartModal } from "./ScanToCartModal"
import { Ticket } from "./Ticket"

// Matches settings.client_data_required_above's default — only a UI hint
// (bolding the client fields), the backend is the actual source of truth
// and rejects the request regardless of what this shows.
const CLIENT_DATA_HINT_THRESHOLD = 700

interface SaleScreenProps {
  session: CashSession
  onSessionClosed: () => void
}

function newPaymentLine(): PaymentLine {
  return { id: crypto.randomUUID(), metodo: "efectivo", monto: "", recibido: "" }
}

/** Rotates via the `<details>` parent's own `group-open` state — no click
 * handler of its own, it just mirrors what the disclosure already did. */
function DisclosureChevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0 text-ink-soft transition-transform duration-150 group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function SaleScreen({ session, onSessionClosed }: SaleScreenProps) {
  const { user, logout } = useAuth()
  const [cart, setCart] = useState<CartLine[]>([])
  const [descuentoMonto, setDescuentoMonto] = useState("")
  const [descuentoMotivo, setDescuentoMotivo] = useState("")
  const [clienteNombre, setClienteNombre] = useState("")
  const [clienteDocTipo, setClienteDocTipo] = useState("DNI")
  const [clienteDocNum, setClienteDocNum] = useState("")
  const [payments, setPayments] = useState<PaymentLine[]>([newPaymentLine()])
  const [scanOpen, setScanOpen] = useState(false)
  const [closeRegisterOpen, setCloseRegisterOpen] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [descuentoOpen, setDescuentoOpen] = useState(false)
  const [clienteOpen, setClienteOpen] = useState(false)

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.cantidad, 0)
  const descuento = Number(descuentoMonto) || 0
  const total = Math.max(subtotal - descuento, 0)
  const requiresClientData = total > CLIENT_DATA_HINT_THRESHOLD
  // What the product grid reads to show which cards are already in the cart:
  // the cart itself, so there is no second copy of "what's selected" to drift.
  const cartQuantities = new Map(cart.map((line) => [line.productId, line.cantidad]))

  // One-directional nudge, same pattern as the payment auto-fill below: once
  // the total crosses the threshold this pries the disclosure open so the
  // required fields aren't hidden behind a collapsed "+ Datos del cliente",
  // but it never fights a seller who opens (or re-collapses) it themselves.
  useEffect(() => {
    if (requiresClientData) setClienteOpen(true)
  }, [requiresClientData])

  // Keeps the common single-payment case a no-op for the seller: as long as
  // the one payment line's amount is either empty or still exactly what this
  // effect last wrote there, it keeps tracking the live total — so adding a
  // second (or third) product to the cart after the first still moves the
  // amount, instead of leaving it stuck at whatever the total was when the
  // seller's very first item landed. The moment they type something that
  // isn't what was auto-filled — even to correct it — this stops overwriting
  // their edit; adding a second payment line (a mixed payment) does the same.
  const autoFilledAmount = useRef<string | null>(null)
  useEffect(() => {
    if (payments.length !== 1) return
    const [payment] = payments
    const untouched = payment.monto === "" || payment.monto === autoFilledAmount.current
    if (!untouched || total <= 0) return
    const next = total.toFixed(2)
    if (payment.monto === next) return
    autoFilledAmount.current = next
    setPayments([{ ...payment, monto: next }])
  }, [total, payments])

  function addToCart(product: {
    id: string
    name: string
    price: number
    stock: number
    thumbnailUrl: string | null
  }) {
    setError(null)
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id)
      if (existing) {
        return prev.map((line) =>
          line.productId === product.id && line.cantidad < line.stock
            ? { ...line, cantidad: line.cantidad + 1 }
            : line,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          stock: product.stock,
          cantidad: 1,
          thumbnailUrl: product.thumbnailUrl,
        },
      ]
    })
  }

  function handleSelectSearchResult(product: SellerProduct) {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      thumbnailUrl: product.thumbnail_url ?? product.image_url,
    })
  }

  function handleScanMatch(match: RecognitionMatch) {
    // Anonymous scans hide `name`, but this modal only ever runs inside an
    // authenticated sale, so the backend always includes it here.
    addToCart({
      id: match.product_id,
      name: match.name ?? match.description,
      price: match.price,
      stock: match.stock,
      thumbnailUrl: match.thumbnail_url ?? match.image_url,
    })
  }

  function changeQuantity(productId: string, cantidad: number) {
    setCart((prev) => {
      if (cantidad <= 0) return prev.filter((line) => line.productId !== productId)
      return prev.map((line) =>
        line.productId === productId ? { ...line, cantidad: Math.min(cantidad, line.stock) } : line,
      )
    })
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((line) => line.productId !== productId))
  }

  function resetForNewSale() {
    setCart([])
    setDescuentoMonto("")
    setDescuentoMotivo("")
    setClienteNombre("")
    setClienteDocNum("")
    setPayments([newPaymentLine()])
    setIdempotencyKey(crypto.randomUUID())
    setError(null)
    setCompletedSale(null)
    setDescuentoOpen(false)
    setClienteOpen(false)
  }

  async function handleCheckout() {
    setError(null)
    if (cart.length === 0) {
      setError("Agrega al menos un producto.")
      return
    }
    setSubmitting(true)
    try {
      const sale = await createSale({
        items: cart.map((line) => ({ product_id: line.productId, cantidad: line.cantidad })),
        payments: payments
          .filter((p) => Number(p.monto) > 0)
          .map((p) => ({
            metodo: p.metodo,
            monto: Number(p.monto),
            recibido: p.metodo === "efectivo" && p.recibido ? Number(p.recibido) : undefined,
          })),
        descuento_monto: descuento || undefined,
        descuento_motivo: descuento > 0 ? descuentoMotivo || undefined : undefined,
        cliente_nombre: clienteNombre || undefined,
        cliente_doc_tipo: clienteNombre ? clienteDocTipo : undefined,
        cliente_doc_num: clienteNombre ? clienteDocNum || undefined : undefined,
        idempotency_key: idempotencyKey,
      })
      setCompletedSale(sale)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar la venta.")
    } finally {
      setSubmitting(false)
    }
  }

  if (completedSale) {
    return (
      <div className="animate-fade-in mx-auto max-w-md px-4 py-6">
        <Ticket sale={completedSale} onNewSale={resetForNewSale} />
      </div>
    )
  }

  return (
    <div className={`min-h-svh bg-paper ${cart.length > 0 ? "pb-24 lg:pb-10" : "pb-10"}`}>
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between lg:max-w-6xl">
          <div>
            <BrandLogo textClassName="font-display text-base font-semibold tracking-tight text-ink" imgClassName="h-7" />
            <p className="text-xs text-ink-soft">{user?.full_name || user?.username}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setCloseRegisterOpen(true)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-transform active:scale-95"
            >
              Cerrar caja
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="text-xs font-medium transition-transform active:scale-95"
              style={{ color: "var(--color-stock-out)" }}
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* One column on a phone (the order below is the order on screen), two
          from lg: the product grid on the left, and everything about the sale
          in progress pinned on the right so it stays visible while browsing. */}
      <main className="mx-auto grid max-w-md gap-5 px-4 py-5 lg:max-w-6xl lg:grid-cols-[1fr_22rem] lg:items-start">
        <section>
          <ProductSearch
            onSelect={handleSelectSearchResult}
            quantities={cartQuantities}
            onChangeQuantity={changeQuantity}
            onScan={() => setScanOpen(true)}
          />
        </section>

        <div className="space-y-5 lg:sticky lg:top-20">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">Carrito</h2>
          <Cart lines={cart} onChangeQuantity={changeQuantity} onRemove={removeFromCart} />
        </section>

        {cart.length > 0 && (
          <>
            {/* Collapsed by default: a discount or a customer's data is the
                exception, not the common sale, and both used to sit as full
                cards between the cart and the checkout button on every single
                transaction. */}
            <details
              open={descuentoOpen}
              onToggle={(event) => setDescuentoOpen(event.currentTarget.open)}
              className="group rounded-xl border border-line bg-surface"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-widest text-ink-soft [&::-webkit-details-marker]:hidden">
                <span>{descuento > 0 ? `Descuento aplicado: −${formatPrice(descuento)}` : "+ Descuento"}</span>
                <DisclosureChevron />
              </summary>
              <div className="flex gap-2 px-3 pb-3">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.10"
                  placeholder="Monto (S/)"
                  value={descuentoMonto}
                  onChange={(event) => setDescuentoMonto(event.target.value)}
                  className="w-28 rounded-lg border border-line bg-inset px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Motivo"
                  value={descuentoMotivo}
                  onChange={(event) => setDescuentoMotivo(event.target.value)}
                  className="flex-1 rounded-lg border border-line bg-inset px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>
            </details>

            {/* Forced open once the total crosses the threshold (see the
                clienteOpen effect above) — closed by default otherwise,
                same reasoning as the discount disclosure. */}
            <details
              open={clienteOpen}
              onToggle={(event) => setClienteOpen(event.currentTarget.open)}
              className="group rounded-xl border border-line bg-surface"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-widest text-ink-soft [&::-webkit-details-marker]:hidden">
                <span>
                  {clienteNombre ? `Cliente: ${clienteNombre}` : "+ Datos del cliente"}
                  {requiresClientData && !clienteNombre && (
                    <span style={{ color: "var(--color-stock-out)" }}> · requerido sobre S/ 700</span>
                  )}
                </span>
                <DisclosureChevron />
              </summary>
              <div className="space-y-2 px-3 pb-3">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={clienteNombre}
                  onChange={(event) => setClienteNombre(event.target.value)}
                  className="w-full rounded-lg border border-line bg-inset px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <div className="flex gap-2">
                  <select
                    value={clienteDocTipo}
                    onChange={(event) => setClienteDocTipo(event.target.value)}
                    className="rounded-lg border border-line bg-inset px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="DNI">DNI</option>
                    <option value="RUC">RUC</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Número de documento"
                    value={clienteDocNum}
                    onChange={(event) => setClienteDocNum(event.target.value)}
                    className="flex-1 rounded-lg border border-line bg-inset px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            </details>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Cobro</h2>
              <PaymentsForm payments={payments} onChange={setPayments} />
            </section>

            <section className="space-y-1 rounded-xl border border-line bg-surface p-3 text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-ink-soft">
                  <span>Descuento</span>
                  <span className="tabular-nums">−{formatPrice(descuento)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-ink">
                <span>Total</span>
                <span className="tabular-nums">{formatPrice(total)}</span>
              </div>
            </section>

            {error && (
              <p className="animate-fade-in text-sm" style={{ color: "var(--color-stock-out)" }}>
                {error}
              </p>
            )}

            {/* Desktop only: the sticky right column is already always on
                screen there, so this inline button is reachable without a
                second, fixed copy competing for the same space. */}
            <button
              type="button"
              onClick={() => void handleCheckout()}
              disabled={submitting}
              className="hidden w-full rounded-lg bg-ink py-3 text-base font-semibold text-paper transition-transform active:scale-[0.98] disabled:opacity-60 lg:block"
            >
              {submitting ? "Cobrando…" : `Cobrar ${formatPrice(total)}`}
            </button>
          </>
        )}
        </div>
      </main>

      {/* Mobile only: everything about the sale (descuento, cliente, cobro,
          totals) sits above this in normal document flow, so without a fixed
          bar "Cobrar" is however far a scroll away as the sale has grown. */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => void handleCheckout()}
            disabled={submitting}
            className="flex w-full items-center justify-between rounded-lg bg-ink px-4 py-3 text-base font-semibold text-paper transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <span>{submitting ? "Cobrando…" : "Cobrar"}</span>
            <span className="tabular-nums">{formatPrice(total)}</span>
          </button>
        </div>
      )}

      <ScanToCartModal open={scanOpen} onClose={() => setScanOpen(false)} onMatch={handleScanMatch} />
      <CloseRegisterModal
        open={closeRegisterOpen}
        session={session}
        onClose={() => setCloseRegisterOpen(false)}
        onClosed={() => {
          setCloseRegisterOpen(false)
          onSessionClosed()
        }}
      />
    </div>
  )
}
