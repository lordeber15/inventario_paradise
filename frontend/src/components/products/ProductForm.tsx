import { useState, type FormEvent } from "react"
import type { AdminProduct, ProductFieldValues, ProductFormValues } from "../../api/products"

const MAX_IMAGES = 6

interface ProductFormProps {
  initialProduct?: AdminProduct
  onSubmit: (values: ProductFormValues | ProductFieldValues) => Promise<void>
  submitLabel: string
}

const INPUT_CLASS =
  "w-full rounded-lg border border-line bg-inset px-3 py-2 text-sm text-ink " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
const LABEL_CLASS = "mb-1 block text-xs font-medium text-ink-soft"

interface PendingImage {
  file: File
  previewUrl: string
}

export function ProductForm({ initialProduct, onSubmit, submitLabel }: ProductFormProps) {
  const isCreate = !initialProduct

  const [name, setName] = useState(initialProduct?.name ?? "")
  const [description, setDescription] = useState(initialProduct?.description ?? "")
  const [category, setCategory] = useState(initialProduct?.category ?? "")
  const [price, setPrice] = useState(initialProduct ? String(initialProduct.price) : "")
  const [stock, setStock] = useState(initialProduct ? String(initialProduct.stock) : "0")
  const [barcode, setBarcode] = useState(initialProduct?.barcode ?? "")
  const [images, setImages] = useState<PendingImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleFilesSelected(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return
    if (files.length > MAX_IMAGES) {
      setError(`Puedes subir hasta ${MAX_IMAGES} fotos.`)
      return
    }
    setError(null)
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    setImages(files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })))
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (isCreate && images.length === 0) {
      setError("Al menos una foto del producto es obligatoria.")
      return
    }

    setSubmitting(true)
    try {
      if (isCreate) {
        await onSubmit({ name, description, category, price, stock, barcode, images: images.map((img) => img.file) })
      } else {
        await onSubmit({ name, description, category, price, stock, barcode })
      }
    } catch {
      setError("No se pudo guardar el producto. Revisa los datos e intenta de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5">
      {isCreate && (
        <div className="space-y-3 rounded-xl border border-dashed border-line bg-surface p-4">
          <div>
            <span className={LABEL_CLASS}>Fotos del producto</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(event) => handleFilesSelected(event.target.files)}
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-paper"
            />
            <p className="mt-2 text-xs text-ink-soft">
              JPEG, PNG o WEBP, hasta 8&nbsp;MB cada una, máximo {MAX_IMAGES}. Registrar 2 a 4 fotos desde ángulos
              distintos (frente, dorso, etiqueta) mejora la precisión del reconocimiento. Si algún código de barras
              aparece en cualquiera de las fotos, se detecta automáticamente.
            </p>
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {images.map((img, index) => (
                <div key={img.previewUrl} className="relative">
                  <img src={img.previewUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
                  {index === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] font-medium text-paper">
                      Portada
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label={`Quitar foto ${index + 1}`}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <label className="block">
        <span className={LABEL_CLASS}>Nombre</span>
        <input
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Descripción</span>
        <textarea
          required
          rows={3}
          maxLength={5000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={LABEL_CLASS}>Precio (S/)</span>
          <input
            type="number"
            required
            min={0}
            step="0.01"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Stock</span>
          <input
            type="number"
            required
            min={0}
            step={1}
            inputMode="numeric"
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <label className="block">
        <span className={LABEL_CLASS}>Categoría (opcional)</span>
        <input
          type="text"
          maxLength={100}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Ej: Bolsos, Velas, Cerámica"
          className={INPUT_CLASS}
        />
      </label>

      <label className="block">
        <span className={LABEL_CLASS}>Código de barras (opcional)</span>
        <input
          type="text"
          maxLength={64}
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
          placeholder="Se detecta automáticamente si aparece en alguna foto"
          className={INPUT_CLASS}
        />
      </label>

      {error && (
        <p className="text-sm" style={{ color: "var(--color-stock-out)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-paper disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {submitting ? "Guardando…" : submitLabel}
      </button>
    </form>
  )
}
