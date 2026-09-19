import type { PublicProduct } from "../../api/products"
import { ProductCard } from "./ProductCard"

interface ProductCatalogProps {
  products: PublicProduct[]
  onSelect: (product: PublicProduct) => void
}

// Stagger the entrance of only the first screenful — the rest render
// instantly, since animating all 200 products on load is 200 simultaneous
// reflows disguised as a nicety, not a nicety itself.
const STAGGER_COUNT = 8

/** Shared by CatalogSkeleton, so the placeholders land on the same columns. */
export const CATALOG_GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5"

export function ProductCatalog({ products, onSelect }: ProductCatalogProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-widest text-ink-soft">Catálogo vacío</p>
        <p className="mt-2 text-sm text-ink-soft">Todavía no hay productos cargados.</p>
      </div>
    )
  }

  return (
    <ul className={CATALOG_GRID_CLASS} style={{ contentVisibility: "auto" }}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={onSelect}
          className={index < STAGGER_COUNT ? "catalog-item-in" : undefined}
          style={index < STAGGER_COUNT ? { animationDelay: `${index * 40}ms` } : undefined}
        />
      ))}
    </ul>
  )
}
