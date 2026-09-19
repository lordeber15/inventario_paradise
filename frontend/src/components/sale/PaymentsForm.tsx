import type { PaymentMethod } from "../../api/sales"
import { formatPrice } from "../../lib/currency"

export interface PaymentLine {
  id: string
  metodo: PaymentMethod
  monto: string
  recibido: string
}

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "yape_plin", label: "Yape/Plin" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
]

interface PaymentsFormProps {
  payments: PaymentLine[]
  onChange: (payments: PaymentLine[]) => void
}

export function PaymentsForm({ payments, onChange }: PaymentsFormProps) {
  function update(id: string, patch: Partial<PaymentLine>) {
    onChange(payments.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function addLine() {
    onChange([...payments, { id: crypto.randomUUID(), metodo: "efectivo", monto: "", recibido: "" }])
  }

  function removeLine(id: string) {
    onChange(payments.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-2">
      {payments.map((payment) => {
        const monto = Number(payment.monto) || 0
        const recibido = Number(payment.recibido) || 0
        const vuelto = payment.metodo === "efectivo" && recibido > monto ? recibido - monto : null

        return (
          <div key={payment.id} className="rounded-lg border border-line bg-surface p-3">
            <div className="flex items-center gap-2">
              <select
                value={payment.metodo}
                onChange={(event) => update(payment.id, { metodo: event.target.value as PaymentMethod })}
                className="rounded-lg border border-line bg-inset px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.10"
                placeholder="Monto"
                value={payment.monto}
                onChange={(event) => update(payment.id, { monto: event.target.value })}
                className="w-24 flex-1 rounded-lg border border-line bg-inset px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              {payments.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(payment.id)}
                  aria-label="Quitar este pago"
                  className="shrink-0 text-sm transition-transform active:scale-90"
                  style={{ color: "var(--color-stock-out)" }}
                >
                  ×
                </button>
              )}
            </div>

            {payment.metodo === "efectivo" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.10"
                  placeholder="Recibido (para el vuelto)"
                  value={payment.recibido}
                  onChange={(event) => update(payment.id, { recibido: event.target.value })}
                  className="w-full rounded-lg border border-line bg-inset px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
                {vuelto != null && (
                  <span className="shrink-0 whitespace-nowrap text-xs text-ink-soft">
                    Vuelto: {formatPrice(vuelto)}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={addLine}
        className="text-sm font-medium text-accent transition-transform active:scale-95"
      >
        + Agregar otro método de pago
      </button>
    </div>
  )
}
