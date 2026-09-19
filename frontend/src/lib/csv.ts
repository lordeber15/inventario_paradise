import type { AdminProduct } from "../api/products"

const HEADERS = ["Nombre", "Categoría", "Código de barras", "Precio", "Stock", "Estado"]

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function productsToCsv(products: AdminProduct[]): string {
  const rows = products.map((product) =>
    [
      product.name,
      product.category ?? "",
      product.barcode ?? "",
      product.price.toFixed(2),
      String(product.stock),
      product.is_active ? "Activo" : "Eliminado",
    ]
      .map(escapeCsvField)
      .join(","),
  )
  // Leading BOM so Excel opens the file as UTF-8 instead of guessing an
  // 8-bit codepage and mangling accented headers/categories.
  return "﻿" + [HEADERS.join(","), ...rows].join("\r\n")
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
