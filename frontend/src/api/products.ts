import { apiDelete, apiGet, apiPostForm, apiPostJson, apiPutForm } from "./client"

export interface PublicProductImage {
  image_url: string
  thumbnail_url: string | null
}

export interface PublicProduct {
  id: string
  name: string
  description: string
  category: string | null
  stock: number
  price: number
  thumbnail_url: string | null
  image_url: string
  images: PublicProductImage[]
  created_at: string
}

export interface ProductImage {
  id: string
  image_url: string
  thumbnail_url: string | null
  is_primary: boolean
  position: number
}

export interface AdminProduct {
  id: string
  name: string
  description: string
  category: string | null
  price: number
  stock: number
  barcode: string | null
  is_active: boolean
  image_url: string
  thumbnail_url: string | null
  images: ProductImage[]
  image_count: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SellerProduct {
  id: string
  name: string
  description: string
  stock: number
  price: number
  thumbnail_url: string | null
  image_url: string
}

export interface ProductFormValues {
  name: string
  description: string
  category: string
  price: string
  stock: string
  barcode: string
  images: File[]
}

export interface ProductFieldValues {
  name: string
  description: string
  category: string
  price: string
  stock: string
  barcode: string
}

export function fetchPublicProducts(): Promise<PublicProduct[]> {
  return apiGet<PublicProduct[]>("/products")
}

// Same GET /api/products the public catalog uses, but called with a session
// (a vendedor or admin), so the backend includes `name` in the response —
// audience-scoped the same way the scan endpoint's match is (see
// docs/PLAN-POS.md §5). Used to build a sale's cart by typing.
//
// With no query this returns the most recent products, which is what fills
// the sale screen's grid before anyone types — so browsing needs no separate
// endpoint. 50 rather than 20 because a grid shows far more at once than the
// old list did; the endpoint's own ceiling is 100.
export function searchProductsForSale(query: string): Promise<SellerProduct[]> {
  const params = new URLSearchParams({ limit: "50" })
  if (query.trim()) params.set("q", query.trim())
  return apiGet<SellerProduct[]>(`/products?${params.toString()}`)
}

export function fetchAdminProducts(includeInactive = false): Promise<AdminProduct[]> {
  const query = includeInactive ? "?include_inactive=true" : ""
  return apiGet<AdminProduct[]>(`/admin/products${query}`)
}

export function fetchAdminProduct(id: string): Promise<AdminProduct> {
  return apiGet<AdminProduct>(`/admin/products/${id}`)
}

function toFieldFormData(values: ProductFieldValues): FormData {
  const form = new FormData()
  form.set("name", values.name)
  form.set("description", values.description)
  form.set("price", values.price)
  form.set("stock", values.stock)
  if (values.barcode) form.set("barcode", values.barcode)
  if (values.category) form.set("category", values.category)
  return form
}

function imagesToFormData(images: File[]): FormData {
  const form = new FormData()
  images.forEach((image) => form.append("images", image))
  return form
}

export function createProduct(values: ProductFormValues): Promise<AdminProduct> {
  const form = toFieldFormData(values)
  values.images.forEach((image) => form.append("images", image))
  return apiPostForm<AdminProduct>("/admin/products", form)
}

export function updateProduct(id: string, values: ProductFieldValues): Promise<AdminProduct> {
  return apiPutForm<AdminProduct>(`/admin/products/${id}`, toFieldFormData(values))
}

export function deleteProduct(id: string): Promise<void> {
  return apiDelete(`/admin/products/${id}`)
}

export function restoreProduct(id: string): Promise<AdminProduct> {
  return apiPostJson<AdminProduct>(`/admin/products/${id}/restore`)
}

export function addProductImages(id: string, images: File[]): Promise<AdminProduct> {
  return apiPostForm<AdminProduct>(`/admin/products/${id}/images`, imagesToFormData(images))
}

export function deleteProductImage(productId: string, imageId: string): Promise<AdminProduct> {
  return apiDelete<AdminProduct>(`/admin/products/${productId}/images/${imageId}`)
}

export function setPrimaryProductImage(productId: string, imageId: string): Promise<AdminProduct> {
  return apiPostJson<AdminProduct>(`/admin/products/${productId}/images/${imageId}/primary`)
}
