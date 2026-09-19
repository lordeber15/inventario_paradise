import type { Sale } from "../../api/sales"
import { formatPrice } from "../../lib/currency"
import { BrandLogo } from "../layout/BrandLogo"

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  yape_plin: "Yape/Plin",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
}

interface TicketProps {
  sale: Sale
  // Exactly one of these: the seller flow offers to start over, the admin
  // dashboard's read-only detail view just offers to dismiss it.
  onNewSale?: () => void
  onClose?: () => void
}

export function Ticket({ sale, onNewSale, onClose }: TicketProps) {
  // What a cashier actually needs to say out loud to the customer — the
  // itemized breakdown below still lists it per payment line for the printed
  // record, but that's easy to miss in the moment right after charging.
  const vuelto = sale.payments
    .filter((payment) => payment.metodo === "efectivo" && payment.recibido != null && payment.recibido > payment.monto)
    .reduce((sum, payment) => sum + (payment.recibido! - payment.monto), 0)

  return (
    <div className="mx-auto max-w-sm space-y-4">
      {vuelto > 0 && (
        <div className="animate-fade-in rounded-xl border border-accent bg-accent-soft px-5 py-4 text-center print:hidden">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Vuelto</p>
          <p className="font-display text-3xl font-semibold text-ink">{formatPrice(vuelto)}</p>
        </div>
      )}

      {/* print:only content sits in the same DOM as the on-screen summary so
          there's no separate print template to keep in sync — the buttons
          below just don't render on paper. */}
      <div className="rounded-xl border border-line bg-surface p-5 print:border-none print:shadow-none">
        <div className="text-center">
          <div className="flex justify-center">
            <BrandLogo />
          </div>
          <p className="text-xs text-ink-soft">
            Ticket {sale.serie}-{String(sale.correlativo).padStart(6, "0")}
          </p>
          <p className="text-xs text-ink-soft">{new Date(sale.created_at).toLocaleString("es-PE")}</p>
        </div>

        {sale.cliente_nombre && (
          <p className="mt-3 text-xs text-ink-soft">
            Cliente: {sale.cliente_nombre}
            {sale.cliente_doc_num ? ` · ${sale.cliente_doc_tipo ?? "Doc."} ${sale.cliente_doc_num}` : ""}
          </p>
        )}

        <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
          {sale.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="text-ink">
                {item.cantidad} × {item.producto_nombre}
              </span>
              <span className="shrink-0 tabular-nums text-ink">{formatPrice(item.subtotal_linea)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-ink-soft">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatPrice(sale.subtotal)}</span>
          </div>
          {sale.descuento_monto > 0 && (
            <div className="flex justify-between text-ink-soft">
              <span>Descuento{sale.descuento_motivo ? ` (${sale.descuento_motivo})` : ""}</span>
              <span className="tabular-nums">−{formatPrice(sale.descuento_monto)}</span>
            </div>
          )}
          <div className="flex justify-between text-ink-soft">
            <span>IGV incluido</span>
            <span className="tabular-nums">{formatPrice(sale.igv)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-ink">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(sale.total)}</span>
          </div>
        </div>

        <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          {sale.payments.map((payment) => (
            <div key={payment.id} className="flex justify-between text-ink-soft">
              <span>{PAYMENT_METHOD_LABEL[payment.metodo] ?? payment.metodo}</span>
              <span className="tabular-nums">{formatPrice(payment.monto)}</span>
            </div>
          ))}
          {sale.payments.map(
            (payment) =>
              payment.metodo === "efectivo" &&
              payment.recibido != null &&
              payment.recibido > payment.monto && (
                <div key={`${payment.id}-vuelto`} className="flex justify-between text-ink-soft">
                  <span>Vuelto</span>
                  <span className="tabular-nums">{formatPrice(payment.recibido - payment.monto)}</span>
                </div>
              ),
          )}
        </div>
      </div>

      {/* Stacked rather than side by side: the cashier's very next move is
          almost always the next sale, not the printer, so that action gets
          the full-width primary spot instead of splitting attention evenly
          with "Imprimir". */}
      <div className="space-y-2 print:hidden">
        {onNewSale && (
          <button
            type="button"
            onClick={onNewSale}
            className="w-full rounded-lg bg-ink px-4 py-3 text-base font-semibold text-paper transition-transform active:scale-[0.98]"
          >
            Nueva venta
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-ink px-4 py-3 text-base font-semibold text-paper transition-transform active:scale-[0.98]"
          >
            Cerrar
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-transform active:scale-[0.98]"
        >
          Imprimir
        </button>
      </div>
    </div>
  )
}
