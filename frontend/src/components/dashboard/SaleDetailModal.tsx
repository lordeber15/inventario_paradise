import { useEffect, useRef } from "react"
import type { Sale } from "../../api/sales"
import { Ticket } from "../sale/Ticket"

interface SaleDetailModalProps {
  sale: Sale | null
  onClose: () => void
}

export function SaleDetailModal({ sale, onClose }: SaleDetailModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (sale) {
      dialog?.showModal()
      return () => dialog?.close()
    }
  }, [sale])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      aria-label="Detalle de venta"
      className="product-dialog w-[min(92vw,26rem)] rounded-2xl bg-transparent p-0 text-ink shadow-2xl"
    >
      {sale && <Ticket sale={sale} onClose={onClose} />}
    </dialog>
  )
}
