import { useEffect, useMemo, useState } from "react"
import { fetchPublicProducts, type PublicProduct } from "../api/products"
import { fetchAppSettings } from "../api/settings"
import { CatalogFooter } from "../components/catalog/CatalogFooter"
import { CategoryCircles, type CategorySummary } from "../components/catalog/CategoryCircles"
import { Hero } from "../components/catalog/Hero"
import { NewArrivals } from "../components/catalog/NewArrivals"
import { ScanCallout } from "../components/catalog/ScanCallout"
import { StatsStrip } from "../components/catalog/StatsStrip"
import { SECTION_TITLE_CLASS } from "../components/catalog/styles"
import { BrandLogo } from "../components/layout/BrandLogo"
import { ThemeToggle } from "../components/layout/ThemeToggle"
import { CatalogSkeleton } from "../components/products/CatalogSkeleton"
import { ProductCatalog } from "../components/products/ProductCatalog"
import { ProductModal } from "../components/products/ProductModal"
import { isNew } from "../components/products/recency"
import { PublicScanModal } from "../components/recognition/PublicScanModal"
import { searchable } from "../lib/text"

type Status = "loading" | "ready" | "error"
type Sort = "recent" | "price-asc" | "price-desc"

// Same placeholder BrandLogo falls back to, so the hero and the header never
// disagree about what the shop is called.
const BRAND_PLACEHOLDER = "INVENTARIO"

// One card is not a rail; the section hides itself below this.
const MIN_NEW_ARRIVALS = 2
const MAX_NEW_ARRIVALS = 8

// The sticky header is two rows on a phone and one from `sm`; the anchor
// target needs that much clearance or "Ver catálogo" lands under it.
const CATALOG_SECTION_CLASS = "scroll-mt-32 sm:scroll-mt-24"

export function PublicCatalogPage() {
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [status, setStatus] = useState<Status>("loading")
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>("recent")
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null)
  const [scanOpen, setScanOpen] = useState(false)

  useEffect(() => {
    fetchPublicProducts()
      .then((data) => {
        setProducts(data)
        setStatus("ready")
      })
      .catch(() => setStatus("error"))
    // Fetched here as well as inside BrandLogo (which keeps its own copy for
    // the header): the hero's title needs the name as data, not as markup.
    // A failure just leaves the placeholder — same policy as BrandLogo.
    fetchAppSettings()
      .then((settings) => setCompanyName(settings.company_name))
      .catch(() => {})
  }, [])

  // Derived from the full list, not `filtered`, so picking a category doesn't
  // shrink the circles down to just itself. `products` arrives newest first,
  // so the first product seen per category is also its most recent — that is
  // the photo the circle wears (falling back to the first that has one).
  const categorySummaries = useMemo<CategorySummary[]>(() => {
    const byName = new Map<string, CategorySummary>()
    for (const product of products) {
      if (!product.category) continue
      const entry = byName.get(product.category)
      if (!entry) {
        byName.set(product.category, { name: product.category, count: 1, thumbnailUrl: product.thumbnail_url })
      } else {
        entry.count += 1
        entry.thumbnailUrl ??= product.thumbnail_url
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "es"))
  }, [products])

  const categoryNames = useMemo(() => categorySummaries.map((entry) => entry.name), [categorySummaries])

  const newArrivals = useMemo(
    () => products.filter((product) => isNew(product.created_at)),
    [products],
  )

  // The hero's one big photo: the newest thing still on the shelf. If it's
  // all sold out, the newest thing regardless — the tag will say so.
  const featured = useMemo(() => products.find((product) => product.stock > 0) ?? products[0], [products])

  const filtered = useMemo(() => {
    const term = searchable(query.trim())
    return products.filter((product) => {
      if (category && product.category !== category) return false
      if (!term) return true
      return searchable(product.name).includes(term) || searchable(product.description).includes(term)
    })
  }, [products, query, category])

  const sorted = useMemo(() => {
    if (sort === "recent") return filtered
    const direction = sort === "price-asc" ? 1 : -1
    return [...filtered].sort((a, b) => (a.price - b.price) * direction)
  }, [filtered, sort])

  // Once the visitor is searching or has picked a category, the page is a
  // results page: the editorial blocks step aside and the grid comes up. The
  // circles stay because they *are* the category control.
  const filtering = query.trim() !== "" || category !== null
  const ready = status === "ready" && products.length > 0
  const showHero = ready && !filtering
  const showNewArrivals = showHero && newArrivals.length >= MIN_NEW_ARRIVALS
  // With the hero on screen its title is the page's h1; without it, the
  // catalogue's own heading is the top of the outline, as it was before.
  const CatalogHeading = showHero ? "h2" : "h1"

  function pickCategory(name: string) {
    setCategory(name)
    document.getElementById("catalogo")?.scrollIntoView({ block: "start" })
  }

  return (
    <div className="min-h-svh bg-paper">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        {/* One ThemeToggle, moved by flex order rather than rendered twice:
            brand and switch share the first row on a phone, the search row
            wraps under them; from `sm` it is all one row. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:py-4">
          <div className="order-1">
            <BrandLogo />
          </div>

          <div className="order-3 flex basis-full gap-2 sm:order-2 sm:ml-auto sm:basis-auto">
            <input
              type="search"
              inputMode="search"
              placeholder="Buscar producto…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 sm:w-64"
            />
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent-soft"
            >
              Buscar por foto
            </button>
          </div>

          <div className="order-2 ml-auto flex items-center sm:order-3 sm:ml-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-6 sm:gap-14 sm:py-10">
        {status === "loading" && <CatalogSkeleton />}

        {status === "error" && (
          <div className="rounded-xl border border-dashed px-6 py-16 text-center" style={{ borderColor: "var(--color-stock-out)" }}>
            <p className="text-sm" style={{ color: "var(--color-stock-out)" }}>
              No se pudo cargar el catálogo. Intenta de nuevo más tarde.
            </p>
          </div>
        )}

        {showHero && (
          <>
            <Hero
              title={companyName ?? BRAND_PLACEHOLDER}
              productCount={products.length}
              categoryCount={categorySummaries.length}
              featured={featured}
              onSelect={setSelectedProduct}
              onScan={() => setScanOpen(true)}
            />
            <StatsStrip
              productCount={products.length}
              categoryCount={categorySummaries.length}
              newCount={newArrivals.length}
            />
          </>
        )}

        {ready && categorySummaries.length > 0 && (
          <CategoryCircles
            categories={categorySummaries}
            total={products.length}
            active={category}
            onChange={setCategory}
          />
        )}

        {showNewArrivals && (
          <NewArrivals products={newArrivals.slice(0, MAX_NEW_ARRIVALS)} onSelect={setSelectedProduct} />
        )}

        {status === "ready" && (
          // Named region: the same product can also be in the hero and in
          // "Novedades", so anything that needs *the grid's* copy of it — the
          // e2e specs above all — scopes to this region.
          <section id="catalogo" aria-label="Catálogo" className={CATALOG_SECTION_CLASS}>
            {products.length > 0 && (
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CatalogHeading className={SECTION_TITLE_CLASS}>{category ?? "Catálogo"}</CatalogHeading>
                  <p className="mt-1 text-sm tabular-nums text-ink-soft">
                    {sorted.length} de {products.length} artículos
                  </p>
                </div>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as Sort)}
                  aria-label="Ordenar por"
                  className="shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  <option value="recent">Más recientes</option>
                  <option value="price-asc">Precio: menor a mayor</option>
                  <option value="price-desc">Precio: mayor a menor</option>
                </select>
              </div>
            )}
            <ProductCatalog products={sorted} onSelect={setSelectedProduct} />
          </section>
        )}

        {ready && <ScanCallout onScan={() => setScanOpen(true)} />}
      </main>

      <CatalogFooter categories={categoryNames} onPickCategory={pickCategory} />

      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      <PublicScanModal open={scanOpen} onClose={() => setScanOpen(false)} />
    </div>
  )
}
