import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchSalesPage, fetchSalesSummary, type SalesSummary } from "../api/adminSales"
import { fetchSale, voidSale, type Sale } from "../api/sales"
import { BarChart } from "../components/dashboard/BarChart"
import { DailyTrendChart } from "../components/dashboard/DailyTrendChart"
import { DateRangePicker } from "../components/dashboard/DateRangePicker"
import { SaleDetailModal } from "../components/dashboard/SaleDetailModal"
import { Tabs } from "../components/dashboard/Tabs"
import { VendorTable } from "../components/dashboard/VendorTable"
import { VoidSaleModal } from "../components/dashboard/VoidSaleModal"
import { formatPrice } from "../lib/currency"

type Status = "loading" | "ready" | "error"

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  yape_plin: "Yape/Plin",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
}

const PAGE_SIZE = 15

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function defaultRange(): { desde: string; hasta: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 29)
  return { desde: isoDate(start), hasta: isoDate(end) }
}

function SummaryCard({ label, value, secondary }: { label: string; value: string; secondary?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</p>
      {secondary && <p className="text-xs tabular-nums text-ink-soft">{secondary}</p>}
    </div>
  )
}

export function AdminSalesDashboardPage() {
  const [{ desde, hasta }, setRange] = useState(defaultRange)
  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<Status>("loading")
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null)
  const [detailSale, setDetailSale] = useState<Sale | null>(null)

  async function load() {
    setStatus("loading")
    try {
      const [summaryData, pageData] = await Promise.all([
        fetchSalesSummary(desde, hasta),
        fetchSalesPage({ desde, hasta, page, pageSize: PAGE_SIZE }),
      ])
      setSummary(summaryData)
      setSales(pageData.items)
      setTotal(pageData.total)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, page])

  function handleRangeChange(nextDesde: string, nextHasta: string) {
    setPage(1)
    setRange({ desde: nextDesde, hasta: nextHasta })
  }

  async function confirmVoid(motivo: string) {
    if (!voidingSale) return
    await voidSale(voidingSale.id, motivo)
    setVoidingSale(null)
    void load()
  }

  async function handleViewDetail(sale: Sale) {
    try {
      setDetailSale(await fetchSale(sale.id))
    } catch {
      setDetailSale(sale)
    }
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-ink">Ventas</h1>
        <DateRangePicker desde={desde} hasta={hasta} onChange={handleRangeChange} />
      </div>

      {status === "loading" && <p className="text-sm text-ink-soft">Cargando…</p>}
      {status === "error" && (
        <p className="text-sm" style={{ color: "var(--color-stock-out)" }}>
          No se pudo cargar el resumen de ventas.
        </p>
      )}

      {status === "ready" && summary && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryCard label="Total vendido" value={formatPrice(summary.total_vendido)} />
            <SummaryCard label="Ventas" value={String(summary.cantidad_ventas)} />
            <SummaryCard label="Ticket promedio" value={formatPrice(summary.ticket_promedio)} />
            <SummaryCard label="Descuentos" value={formatPrice(summary.total_descuentos)} />
            <SummaryCard
              label="Anuladas"
              value={String(summary.cantidad_anuladas)}
              secondary={formatPrice(summary.monto_anulado)}
            />
          </div>

          {summary.por_dia.length > 1 && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-soft">Ventas por día</h2>
              <DailyTrendChart items={summary.por_dia} formatValue={formatPrice} />
            </div>
          )}

          <Tabs
            tabs={[
              {
                id: "vendedor",
                label: "Por vendedor",
                render: () => <VendorTable rows={summary.por_vendedor} />,
              },
              {
                id: "metodo",
                label: "Por método de pago",
                render: () => (
                  <BarChart
                    items={summary.por_metodo_pago.map((row) => ({
                      label: PAYMENT_METHOD_LABEL[row.metodo] ?? row.metodo,
                      value: row.total,
                    }))}
                    formatValue={formatPrice}
                  />
                ),
              },
              {
                id: "productos",
                label: "Top productos",
                render: () => (
                  <BarChart
                    items={summary.top_productos.map((row) => ({ label: row.nombre, value: row.cantidad_vendida }))}
                  />
                ),
              },
            ]}
          />

          {summary.stock_bajo.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                Stock bajo (ahora mismo, no depende del rango de fechas)
              </h2>
              <ul className="flex flex-wrap gap-2">
                {summary.stock_bajo.map((product) => (
                  <li key={product.id}>
                    <Link
                      to={`/admin/products/${product.id}/edit`}
                      className="inline-block rounded-full px-3 py-1 text-xs font-medium transition-transform active:scale-95"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--color-stock-low) 16%, transparent)",
                        color: "var(--color-stock-low)",
                      }}
                    >
                      {product.name} · {product.stock}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Ventas del período
            </h2>
            {sales.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-soft">No hay ventas en este rango.</p>
            ) : (
              <>
                {/* Lista dividida en vez de tarjetas sueltas con margen: 15 ventas
                    por página hacen que cada píxel de separación se multiplique. */}
                <ul className="sm:hidden">
                  {sales.map((sale) => (
                    <li key={sale.id} className="border-t border-line px-4 py-2.5 first:border-t-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="tabular-nums text-sm font-medium text-ink">
                          {sale.serie}-{String(sale.correlativo).padStart(6, "0")}
                        </span>
                        <span className="tabular-nums text-sm font-semibold text-ink">{formatPrice(sale.total)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-3 text-xs">
                        <span className="truncate text-ink-soft">
                          {new Date(sale.created_at).toLocaleString("es-PE")} ·{" "}
                          <span
                            className="font-medium"
                            style={{
                              color: sale.estado === "anulada" ? "var(--color-stock-out)" : "var(--color-stock-good)",
                            }}
                          >
                            {sale.estado === "anulada" ? "Anulada" : "Completada"}
                          </span>
                        </span>
                        <span className="flex shrink-0 gap-3">
                          <button
                            type="button"
                            onClick={() => void handleViewDetail(sale)}
                            className="py-1 font-medium text-accent transition-transform active:scale-95"
                          >
                            Ver ticket
                          </button>
                          {sale.estado !== "anulada" && (
                            <button
                              type="button"
                              onClick={() => setVoidingSale(sale)}
                              className="py-1 font-medium transition-transform active:scale-95"
                              style={{ color: "var(--color-stock-out)" }}
                            >
                              Anular
                            </button>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="hidden overflow-x-auto sm:block">
                <table aria-label="Ventas del período" className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                    <tr>
                      <th className="px-4 py-2 font-medium">Fecha</th>
                      <th className="px-4 py-2 font-medium">Comprobante</th>
                      <th className="px-4 py-2 font-medium">Total</th>
                      <th className="px-4 py-2 font-medium">Estado</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id} className="border-b border-line transition-colors last:border-none hover:bg-accent-soft">
                        <td className="px-4 py-2 text-ink-soft">{new Date(sale.created_at).toLocaleString("es-PE")}</td>
                        <td className="px-4 py-2 tabular-nums text-ink">
                          {sale.serie}-{String(sale.correlativo).padStart(6, "0")}
                        </td>
                        <td className="px-4 py-2 tabular-nums text-ink">{formatPrice(sale.total)}</td>
                        <td className="px-4 py-2">
                          <span
                            className="text-xs font-medium"
                            style={{
                              color: sale.estado === "anulada" ? "var(--color-stock-out)" : "var(--color-stock-good)",
                            }}
                          >
                            {sale.estado === "anulada" ? "Anulada" : "Completada"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => void handleViewDetail(sale)}
                              className="text-xs font-medium text-accent transition-transform active:scale-95"
                            >
                              Ver ticket
                            </button>
                            {sale.estado !== "anulada" && (
                              <button
                                type="button"
                                onClick={() => setVoidingSale(sale)}
                                className="text-xs font-medium transition-transform active:scale-95"
                                style={{ color: "var(--color-stock-out)" }}
                              >
                                Anular
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-ink-soft">
                <span>
                  Página {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-line px-2.5 py-1 font-medium text-ink transition-transform active:scale-95 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-line px-2.5 py-1 font-medium text-ink transition-transform active:scale-95 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <SaleDetailModal sale={detailSale} onClose={() => setDetailSale(null)} />
      <VoidSaleModal sale={voidingSale} onClose={() => setVoidingSale(null)} onConfirm={confirmVoid} />
    </div>
  )
}
