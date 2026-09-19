import { useState } from "react"
import type { VendorTotal } from "../../api/adminSales"
import { formatPrice } from "../../lib/currency"

const VISIBLE_ROWS = 8

/** Los vendedores son el único desglose sin tope en el backend (`top_productos`
 * sí tiene `TOP_PRODUCTS_LIMIT`), así que la lista crece para siempre a medida
 * que se acumulan cuentas: por eso se recorta acá y no se pierde ningún dato,
 * ya que `por_vendedor` viene ordenado por total descendente.
 *
 * Tabla y no barras porque la respuesta ya trae `cantidad_ventas` además de
 * `total` — la barra mostraba un solo número y descartaba el resto. El ticket
 * promedio sale de dividirlos, sin tocar el backend. */
export function VendorTable({ rows }: { rows: VendorTotal[] }) {
  const [expanded, setExpanded] = useState(false)

  if (rows.length === 0) {
    return <p className="text-xs text-ink-soft">Sin datos en este rango.</p>
  }

  const visible = expanded ? rows : rows.slice(0, VISIBLE_ROWS)

  return (
    <div>
      {/* Nombrada porque el dashboard pasó a tener dos tablas: sin esto, ni un
          lector de pantalla ni un locator por rol pueden distinguirla de la de
          "Ventas del período". */}
      <table aria-label="Ventas por vendedor" className="w-full text-left text-xs">
        <thead className="text-ink-soft">
          <tr>
            <th className="w-full pb-2 pr-2 font-medium">Vendedor</th>
            <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">Total</th>
            <th className="whitespace-nowrap pb-2 pl-3 text-right font-medium">Ventas</th>
            {/* Derivada de las dos anteriores: es la primera que sobra cuando el
                nombre del vendedor necesita el ancho, en un celular angosto. */}
            <th className="hidden whitespace-nowrap pb-2 pl-3 text-right font-medium sm:table-cell">Prom.</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.vendedor_id} className="border-t border-line">
              <td className="w-full max-w-0 truncate py-1.5 pr-2 text-ink" title={row.vendedor_nombre}>
                {row.vendedor_nombre}
              </td>
              <td className="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums text-ink">
                {formatPrice(row.total)}
              </td>
              <td className="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums text-ink-soft">
                {row.cantidad_ventas}
              </td>
              <td className="hidden whitespace-nowrap py-1.5 pl-3 text-right tabular-nums text-ink-soft sm:table-cell">
                {formatPrice(row.total / row.cantidad_ventas)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length > VISIBLE_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 w-full rounded-lg border border-line py-1.5 text-xs font-medium text-ink transition-transform active:scale-[0.98]"
        >
          {expanded ? "Ver menos" : `Ver los ${rows.length}`}
        </button>
      )}
    </div>
  )
}
