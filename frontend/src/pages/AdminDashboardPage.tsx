import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { deleteProduct, fetchAdminProducts, restoreProduct, type AdminProduct } from "../api/products"
import { DeleteProductModal } from "../components/products/DeleteProductModal"
import { StockBadge } from "../components/products/StockBadge"
import { downloadCsv, productsToCsv } from "../lib/csv"
import { formatPrice } from "../lib/currency"
import { searchable } from "../lib/text"

type Status = "loading" | "ready" | "error"
type StockFilter = "todos" | "bajo" | "agotado"
type Sort = "recent" | "price-asc" | "price-desc"

const LOW_STOCK_THRESHOLD = 5

export function AdminDashboardPage() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [includeInactive, setIncludeInactive] = useState(false)
  const [status, setStatus] = useState<Status>("loading")
  const [query, setQuery] = useState("")
  const [stockFilter, setStockFilter] = useState<StockFilter>("todos")
  const [sort, setSort] = useState<Sort>("recent")
  const [deletingProduct, setDeletingProduct] = useState<AdminProduct | null>(null)

  async function load() {
    setStatus("loading")
    try {
      const data = await fetchAdminProducts(includeInactive)
      setProducts(data)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive])

  const visible = useMemo(() => {
    const term = searchable(query.trim())
    const filtered = products.filter((product) => {
      if (stockFilter === "bajo" && !(product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD)) return false
      if (stockFilter === "agotado" && product.stock > 0) return false
      if (!term) return true
      return (
        searchable(product.name).includes(term) ||
        searchable(product.description).includes(term) ||
        (product.barcode ?? "").includes(query.trim())
      )
    })
    if (sort === "recent") return filtered
    const direction = sort === "price-asc" ? 1 : -1
    return [...filtered].sort((a, b) => (a.price - b.price) * direction)
  }, [products, query, stockFilter, sort])

  // Deleted products aren't really "in stock" — counted from `products`
  // rather than `visible` so the summary reflects the catalog, not whatever
  // the search box currently narrows it to.
  const stats = useMemo(() => {
    const active = products.filter((product) => product.is_active)
    return {
      totalSkus: active.length,
      totalUnits: active.reduce((sum, product) => sum + product.stock, 0),
      lowStock: active.filter((product) => product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD).length,
      outOfStock: active.filter((product) => product.stock <= 0).length,
    }
  }, [products])

  function handleExportCsv() {
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`productos-${date}.csv`, productsToCsv(visible))
  }

  async function confirmDelete() {
    if (!deletingProduct) return
    await deleteProduct(deletingProduct.id)
    setDeletingProduct(null)
    void load()
  }

  async function handleRestore(product: AdminProduct) {
    await restoreProduct(product.id)
    void load()
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-ink">Productos</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Incluir eliminados
          </label>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={status !== "ready" || visible.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DownloadIcon />
            Exportar CSV
          </button>
          <Link to="/admin/products/new" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper">
            + Nuevo
          </Link>
        </div>
      </div>

      {status === "ready" && products.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Productos" value={stats.totalSkus} />
          <StatCard label="Unidades en stock" value={stats.totalUnits} />
          <StatFilterCard
            label="Stock bajo"
            value={stats.lowStock}
            tone="var(--color-stock-low)"
            active={stockFilter === "bajo"}
            onClick={() => setStockFilter(stockFilter === "bajo" ? "todos" : "bajo")}
          />
          <StatFilterCard
            label="Agotados"
            value={stats.outOfStock}
            tone="var(--color-stock-out)"
            active={stockFilter === "agotado"}
            onClick={() => setStockFilter(stockFilter === "agotado" ? "todos" : "agotado")}
          />
        </div>
      )}

      {status === "ready" && products.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            inputMode="search"
            placeholder="Buscar por nombre, descripción o código…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <select
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value as StockFilter)}
            className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="todos">Todo el stock</option>
            <option value="bajo">Stock bajo</option>
            <option value="agotado">Agotado</option>
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            aria-label="Ordenar por"
            className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="recent">Más recientes</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
          </select>
        </div>
      )}

      {status === "loading" && <p className="text-sm text-ink-soft">Cargando…</p>}
      {status === "error" && (
        <p className="text-sm" style={{ color: "var(--color-stock-out)" }}>
          No se pudo cargar el listado.
        </p>
      )}
      {status === "ready" && products.length === 0 && (
        <p className="text-sm text-ink-soft">No hay productos todavía.</p>
      )}
      {status === "ready" && products.length > 0 && visible.length === 0 && (
        <p className="text-sm text-ink-soft">Ningún producto coincide con el filtro.</p>
      )}

      {status === "ready" && visible.length > 0 && (
        <>
          <ul className="space-y-3 sm:hidden">
            {visible.map((product) => (
              <li
                key={product.id}
                className={`rounded-xl border border-line bg-surface p-3 ${product.is_active ? "" : "opacity-60"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={product.thumbnail_url ?? product.image_url}
                      alt=""
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                    <ImageCountBadge count={product.image_count} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                    <p className="text-xs font-medium tabular-nums text-ink-soft">{formatPrice(product.price)}</p>
                  </div>
                  <StockBadge stock={product.stock} />
                </div>
                <div className="mt-3 flex gap-2 text-sm">
                  <Link
                    to={`/admin/products/${product.id}/edit`}
                    className="flex-1 rounded-lg border border-line py-1.5 text-center font-medium text-ink"
                  >
                    Editar
                  </Link>
                  {product.is_active ? (
                    <button
                      type="button"
                      onClick={() => setDeletingProduct(product)}
                      className="flex-1 rounded-lg border py-1.5 font-medium"
                      style={{ borderColor: "var(--color-stock-out)", color: "var(--color-stock-out)" }}
                    >
                      Eliminar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleRestore(product)}
                      className="flex-1 rounded-lg border py-1.5 font-medium"
                      style={{ borderColor: "var(--color-stock-good)", color: "var(--color-stock-good)" }}
                    >
                      Restaurar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Precio</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => (
                  <tr
                    key={product.id}
                    className={`border-b border-line last:border-none ${product.is_active ? "" : "opacity-60"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={product.thumbnail_url ?? product.image_url}
                            alt=""
                            className="h-10 w-10 rounded-md object-cover"
                          />
                          <ImageCountBadge count={product.image_count} />
                        </div>
                        <span className="font-medium text-ink">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-ink-soft">
                      {product.barcode ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{formatPrice(product.price)}</td>
                    <td className="px-4 py-3">
                      <StockBadge stock={product.stock} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          to={`/admin/products/${product.id}/edit`}
                          className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink"
                        >
                          Editar
                        </Link>
                        {product.is_active ? (
                          <button
                            type="button"
                            onClick={() => setDeletingProduct(product)}
                            className="rounded-lg border px-3 py-1.5 font-medium"
                            style={{ borderColor: "var(--color-stock-out)", color: "var(--color-stock-out)" }}
                          >
                            Eliminar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleRestore(product)}
                            className="rounded-lg border px-3 py-1.5 font-medium"
                            style={{ borderColor: "var(--color-stock-good)", color: "var(--color-stock-good)" }}
                          >
                            Restaurar
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

      <DeleteProductModal
        product={deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

/** Plain, non-interactive stat — the two counts a filter wouldn't make sense
 * for (total SKUs, total units). */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-[0_1px_2px_var(--color-card-shadow)]">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  )
}

/** Same shape as StatCard, but doubles as a shortcut into the stock filter
 * already above the table — clicking "Agotados" is the same as picking
 * "Agotado" from the select, just one tap instead of two. */
function StatFilterCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string
  value: number
  tone: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border p-3 text-left shadow-[0_1px_2px_var(--color-card-shadow)] transition-colors ${
        active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent/50"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: tone }}>
        {value}
      </p>
    </button>
  )
}

/** Discreet count of registered photos, so it's easy to spot at a glance which
 * products still only have one angle registered (see docs/PROYECTO.md §5 on
 * why more photos raise recognition confidence). */
function ImageCountBadge({ count }: { count: number }) {
  if (count <= 1) return null
  return (
    <span
      className="absolute -bottom-1 -right-1 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-medium leading-none text-paper"
      title={`${count} fotos registradas`}
    >
      {count}
    </span>
  )
}
