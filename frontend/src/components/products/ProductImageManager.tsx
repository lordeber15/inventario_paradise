import { useState } from "react"
import {
  addProductImages,
  deleteProductImage,
  setPrimaryProductImage,
  type AdminProduct,
} from "../../api/products"

const MAX_IMAGES = 6

interface ProductImageManagerProps {
  product: AdminProduct
  onChange: (product: AdminProduct) => void
}

export function ProductImageManager({ product, onChange }: ProductImageManagerProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const images = [...product.images].sort((a, b) => a.position - b.position)
  const remainingSlots = MAX_IMAGES - images.length

  async function handleAdd(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return
    if (files.length > remainingSlots) {
      setError(`Solo puedes agregar ${remainingSlots} foto(s) más (máximo ${MAX_IMAGES} por producto).`)
      return
    }
    setError(null)
    setBusy(true)
    try {
      onChange(await addProductImages(product.id, files))
    } catch {
      setError("No se pudieron agregar las fotos. Verifica que sean JPEG, PNG o WEBP válidas.")
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(imageId: string) {
    if (images.length <= 1) {
      setError("Un producto debe tener al menos una foto.")
      return
    }
    setError(null)
    setBusy(true)
    try {
      onChange(await deleteProductImage(product.id, imageId))
    } catch {
      setError("No se pudo eliminar la foto.")
    } finally {
      setBusy(false)
    }
  }

  async function handleSetPrimary(imageId: string) {
    setError(null)
    setBusy(true)
    try {
      onChange(await setPrimaryProductImage(product.id, imageId))
    } catch {
      setError("No se pudo cambiar la portada.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-3 rounded-xl border border-dashed border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-soft">Fotos del producto ({images.length}/{MAX_IMAGES})</span>
      </div>

      <div className="flex flex-wrap gap-3">
        {images.map((image) => (
          <div key={image.id} className="relative">
            <img
              src={image.thumbnail_url ?? image.image_url}
              alt=""
              className="h-20 w-20 rounded-lg object-cover"
              style={image.is_primary ? { outline: "2px solid var(--color-accent)", outlineOffset: "2px" } : undefined}
            />
            {image.is_primary ? (
              <span className="absolute left-1 top-1 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] font-medium text-paper">
                Portada
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSetPrimary(image.id)}
                className="absolute left-1 top-1 rounded bg-surface/90 px-1.5 py-0.5 text-[10px] font-medium text-ink disabled:opacity-60"
              >
                Usar como portada
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDelete(image.id)}
              aria-label="Eliminar foto"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper disabled:opacity-60"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {remainingSlots > 0 ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Agregar fotos (otro ángulo)</span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={busy}
            onChange={(event) => void handleAdd(event.target.files).then(() => (event.target.value = ""))}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-paper disabled:opacity-60"
          />
        </label>
      ) : (
        <p className="text-xs text-ink-soft">Se alcanzó el máximo de {MAX_IMAGES} fotos.</p>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--color-stock-out)" }}>
          {error}
        </p>
      )}
    </div>
  )
}
