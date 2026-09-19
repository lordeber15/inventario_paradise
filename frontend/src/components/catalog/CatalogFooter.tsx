import { Link } from "react-router-dom"
import { BrandLogo } from "../layout/BrandLogo"
import { EYEBROW_CLASS } from "./styles"

interface CatalogFooterProps {
  categories: string[]
  onPickCategory: (category: string) => void
}

const FOOTER_LINK_CLASS = "text-sm text-ink transition-colors hover:text-accent"

/** A real footer, cut down to what has somewhere to go: the brand, the
 * categories (a second way into the same filter the circles drive) and the
 * first public link to the panel — until now /admin/login had to be typed. */
export function CatalogFooter({ categories, onPickCategory }: CatalogFooterProps) {
  return (
    <footer className="mt-12 border-t border-line bg-surface sm:mt-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:py-12">
        <div>
          <BrandLogo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
            Catálogo en línea. Precios en soles.
          </p>
        </div>

        {categories.length > 0 && (
          <nav aria-label="Categorías, en el pie">
            <p className={EYEBROW_CLASS}>Categorías</p>
            <ul className="mt-3 flex flex-col gap-2">
              {categories.map((category) => (
                <li key={category}>
                  <button type="button" onClick={() => onPickCategory(category)} className={FOOTER_LINK_CLASS}>
                    {category}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Pinned to the last column so it stays right-aligned when there
            are no categories to fill the middle one. */}
        <div className="sm:col-start-3">
          <p className={EYEBROW_CLASS}>Equipo</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <Link to="/admin/login" className={FOOTER_LINK_CLASS}>
                Acceso al panel
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
