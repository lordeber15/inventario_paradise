import { apiPostForm } from "./client"

export interface RecognitionMatch {
  match_type: "barcode" | "similarity"
  product_id: string
  // Null for an anonymous scan: only a logged-in vendedor/admin gets the
  // product name, same audience split as the rest of the app.
  name: string | null
  description: string
  price: number
  stock: number
  confidence: number | null
  matched_images: number | null
  total_images: number | null
  image_url: string
  thumbnail_url: string | null
}

export interface RecognitionNotFound {
  match_type: "not_found"
  reason: string
}

export type RecognitionResult = RecognitionMatch | RecognitionNotFound

export function scanProductImage(image: File | Blob): Promise<RecognitionResult> {
  const form = new FormData()
  form.set("image", image, "scan.jpg")
  return apiPostForm<RecognitionResult>("/recognition/scan", form)
}
