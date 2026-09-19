import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  createProduct,
  fetchAdminProduct,
  updateProduct,
  type AdminProduct,
  type ProductFieldValues,
  type ProductFormValues,
} from "../api/products"
import { ProductForm } from "../components/products/ProductForm"
import { ProductImageManager } from "../components/products/ProductImageManager"

export function AdminProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [product, setProduct] = useState<AdminProduct | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchAdminProduct(id)
      .then(setProduct)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [id])

  async function handleCreate(values: ProductFormValues) {
    await createProduct(values)
    navigate("/admin", { replace: true })
  }

  async function handleUpdate(values: ProductFieldValues) {
    if (!id) return
    await updateProduct(id, values)
    navigate("/admin", { replace: true })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-ink">{isEdit ? "Editar producto" : "Nuevo producto"}</h1>

      {loading && <p className="text-sm text-ink-soft">Cargando…</p>}
      {loadError && (
        <p className="text-sm" style={{ color: "var(--color-stock-out)" }}>
          No se pudo cargar el producto.
        </p>
      )}
      {!loading && !loadError && !isEdit && (
        <ProductForm onSubmit={(values) => handleCreate(values as ProductFormValues)} submitLabel="Crear producto" />
      )}
      {!loading && !loadError && isEdit && product && (
        <>
          <ProductImageManager product={product} onChange={setProduct} />
          <ProductForm
            initialProduct={product}
            onSubmit={(values) => handleUpdate(values as ProductFieldValues)}
            submitLabel="Guardar cambios"
          />
        </>
      )}
    </div>
  )
}
